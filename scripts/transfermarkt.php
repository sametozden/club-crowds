<?php
/** Generate SQL from a Transfermarkt attendance page. Never connects to a database. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit;
}
$options = getopt('', ['league:', 'season:', 'html:', 'insecure', 'json']);
$leagues = [
    1 => 'L1',
    2 => 'L2',
    3 => 'GB1',
    4 => 'GB2',
    5 => 'GB3',
    6 => 'ES1',
    7 => 'ES2',
    8 => 'FR1',
    9 => 'FR2',
    10 => 'IT1',
    11 => 'IT2',
    12 => 'TR1',
    13 => 'TR2',
    14 => 'PO1',
    15 => 'RU1',
    16 => 'BE1',
    17 => 'NL1',
    18 => 'L3'
];
$league = (int)($options['league'] ?? 0);
$year = (int)($options['season'] ?? 0);
if (!isset($leagues[$league]) || $year < 2000 || $year > 2098) {
    fwrite(STDERR, "Usage: php scripts/transfermarkt.php --league=1 --season=2025 [--html=page.html] > update.sql\n");
    exit(1);
}
if (isset($options['html'])) {
    $html = @file_get_contents($options['html']);
} else {
    if (!function_exists('curl_init')) {
        fwrite(STDERR, "PHP curl extension is required.\n");
        exit(1);
    }
    $url = 'https://www.transfermarkt.com.tr/attendance/besucherzahlen/wettbewerb/' . $leagues[$league] . '/plus/1?saison_id=' . $year;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; ClubCrowds/0.1)',
        CURLOPT_HTTPHEADER => ['Accept-Language: tr-TR,tr;q=0.9,en;q=0.8']
    ]);
    if (isset($options['insecure'])) {
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    }
    $html = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    if ($html === false || $status !== 200) {
        fwrite(STDERR, "Transfermarkt request failed (HTTP $status): $error\n");
        exit(1);
    }
}
if (!$html) {
    fwrite(STDERR, "Could not read the HTML.\n");
    exit(1);
}
libxml_use_internal_errors(true);
$dom = new DOMDocument();
$dom->loadHTML('<?xml encoding="UTF-8">' . $html);
$xpath = new DOMXPath($dom);
$rows = $xpath->query('//table[contains(concat(" ", normalize-space(@class), " "), " items ")]/tbody/tr[contains(concat(" ", normalize-space(@class), " "), " odd ") or contains(concat(" ", normalize-space(@class), " "), " even ")]');
$text = static fn($node) => trim(preg_replace('/\s+/u', ' ', $node->textContent));
$num = static function (string $value): ?int {
    $v = preg_replace('/[^0-9]/u', '', $value);
    return $v === '' ? null : (int)$v;
};
$percent = static function (string $value): ?float {
    $v = preg_replace('/[^0-9,\.]/u', '', $value);
    return $v === '' ? null : (float)str_replace(',', '.', $v);
};
$quote = static fn(string $value) => "'" . str_replace(["\\", "'"], ["\\\\", "''"], $value) . "'";
$season = sprintf('%02d%02d', $year % 100, ($year + 1) % 100);
$statements = [];
$clubRows = [];
foreach ($rows as $row) {
    $cells = $xpath->query('./td', $row);
    if ($cells->length < 8) {
        continue;
    }
    $clubNode = $xpath->query('.//a[contains(@href, "/spielplan/verein/") and normalize-space(text()) != ""]', $cells->item(1))->item(0);
    $stadiumNode = $xpath->query('.//a[contains(@href, "/stadion/verein/")]', $cells->item(1))->item(0);
    $name = $clubNode ? $text($clubNode) : '';
    $stadium = $stadiumNode ? $text($stadiumNode) : '';
    $capacity = $num($text($cells->item(2)));
    $visitors = $num($text($cells->item(3)));
    $average = $num($text($cells->item(4)));
    $occupancy = $percent($text($cells->item(7)));
    if ($name === '' || $capacity === null || $visitors === null || $average === null || $occupancy === null) {
        fwrite(STDERR, "Incomplete club row; no SQL emitted.\n");
        exit(1);
    }
    $image = $xpath->query('.//img', $cells->item(1))->item(0);
    $imagePath = $image ? parse_url($image->getAttribute('src'), PHP_URL_PATH) : '';
    $clubRows[] = [
        'title' => $name,
        'stad' => $stadium,
        'logo' => basename($imagePath ?: ''),
        'capacity' => $capacity,
        'visitors' => $visitors,
        'average' => $average,
        'percentage' => min($occupancy, 100)
    ];
    $n = $quote($name);
    $s = $quote($stadium);
    $occupancy = min($occupancy, 100);
    $statements[] = "INSERT INTO clubs (title, logo, lid, stad) SELECT $n, '', $league, $s WHERE NOT EXISTS (SELECT 1 FROM clubs WHERE TRIM(title) = $n);";
    $statements[] = "UPDATE clubdata SET leagueid=$league, capacity=$capacity, visitors=$visitors, average=$average, percentage=$occupancy WHERE season='$season' AND clubid=(SELECT id FROM clubs WHERE TRIM(title)=$n ORDER BY id LIMIT 1);";
    $statements[] = "INSERT INTO clubdata (clubid, leagueid, season, capacity, visitors, average, percentage) SELECT c.id, $league, '$season', $capacity, $visitors, $average, $occupancy FROM clubs c WHERE TRIM(c.title)=$n AND c.id=(SELECT MIN(c2.id) FROM clubs c2 WHERE TRIM(c2.title)=$n) AND NOT EXISTS (SELECT 1 FROM clubdata d WHERE d.clubid=c.id AND d.season='$season');";
}
if (!$statements) {
    fwrite(STDERR, "No attendance rows found; page structure may have changed. No SQL emitted.\n");
    exit(1);
}
$footer = $xpath->query('//table[contains(concat(" ", normalize-space(@class), " "), " items ")]/tfoot/tr/td');
if ($footer->length < 8) {
    fwrite(STDERR, "League totals not found; no SQL emitted.\n");
    exit(1);
}
$capacity = $num($text($footer->item(2)));
$visitors = $num($text($footer->item(3)));
$average = $num($text($footer->item(4)));
$occupancy = $percent($text($footer->item(7)));
if ($capacity === null || $visitors === null || $average === null || $occupancy === null) {
    fwrite(STDERR, "Incomplete league totals; no SQL emitted.\n");
    exit(1);
}
$occupancy = min($occupancy, 100);
if (isset($options['json'])) {
    echo json_encode([
        'leagueid' => $league,
        'season' => $season,
        'clubs' => $clubRows,
        'league' => ['capacity' => $capacity, 'visitors' => $visitors, 'average' => $average, 'percentage' => $occupancy]
    ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), "\n";
    exit;
}
$statements[] = "UPDATE leaguedata SET capacity=$capacity, visitors=$visitors, average=$average, percentage=$occupancy WHERE leagueid=$league AND season='$season';";
$statements[] = "INSERT INTO leaguedata (leagueid, season, capacity, visitors, average, percentage) SELECT $league, '$season', $capacity, $visitors, $average, $occupancy WHERE NOT EXISTS (SELECT 1 FROM leaguedata WHERE leagueid=$league AND season='$season');";
echo "-- Review before importing. Source: Transfermarkt {$leagues[$league]}, $season\n-- Legacy tables use MyISAM; statements cannot be rolled back as a transaction.\nSET NAMES utf8mb4;\n", implode("\n",
    $statements), "\n";
