export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('pt-BR').format(date);
};

export const getMonthName = (monthStr: string) => {
  // monthStr format YYYY-MM
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  const name = date.toLocaleString('pt-BR', { month: 'long' });
  return `${name.charAt(0).toUpperCase() + name.slice(1)} ${year}`;
};

export const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};