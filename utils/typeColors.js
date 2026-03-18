// Pokémon type colors for UI styling
const TYPE_COLORS = {
  normal: '#A8A878',
  fire: '#F08030',
  water: '#6890F0',
  electric: '#F8D030',
  grass: '#78C850',
  ice: '#98D8D8',
  fighting: '#C03028',
  poison: '#A040A0',
  ground: '#E0C068',
  flying: '#A890F0',
  psychic: '#F85888',
  bug: '#A8B820',
  rock: '#B8A038',
  ghost: '#705898',
  dragon: '#7038F8',
  dark: '#705848',
  steel: '#B8B8D0',
  fairy: '#EE99AC',
};

export function getTypeColor(type) {
  return TYPE_COLORS[type] || '#A8A878';
}

export function getTypeGradient(type) {
  const color = getTypeColor(type);
  return `linear-gradient(135deg, ${color}, ${color}dd)`;
}

export default TYPE_COLORS;
