const countries = {
  Almanya: 'Germany',
  İngiltere: 'England',
  İspanya: 'Spain',
  Fransa: 'France',
  İtalya: 'Italy',
  Türkiye: 'Turkey',
  Portekiz: 'Portugal',
  Rusya: 'Russia',
  Belçika: 'Belgium',
  Hollanda: 'Netherlands',
};

export function englishLeagueName(title) {
  const translated = title.replace(/(Almanya|İngiltere|İspanya|Fransa|İtalya|Türkiye|Portekiz|Rusya|Belçika|Hollanda)\s*$/, country => countries[country.trim()]);
  return translated.replace(/^3\. Lig Germany$/, '3. Liga Germany');
}
