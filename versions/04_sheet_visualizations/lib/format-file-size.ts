export function formatFileSize(bytes: number) {
  if (bytes === 0) {
    return "0 Б";
  }

  const units = ["Б", "КБ", "МБ", "ГБ"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  const maximumFractionDigits = value >= 10 || exponent === 0 ? 0 : 1;

  return `${value.toLocaleString("ru-RU", { maximumFractionDigits })} ${units[exponent]}`;
}
