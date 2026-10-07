/** Keep Home intact, shortening earlier crumbs before later ones, at word boundaries. */
export function fitBreadcrumbLabels(
  labels: readonly string[],
  availableWidth: number,
  measure: (labels: readonly string[]) => number,
): string[] {
  const fitted = [...labels];
  for (let index = 1; index < fitted.length && measure(fitted) > availableWidth; index++) {
    const words = labels[index].trim().split(/\s+/);
    while (words.length > 0 && measure(fitted) > availableWidth) {
      words.pop();
      fitted[index] = words.length ? `${words.join(' ')} …` : '…';
    }
  }
  return fitted;
}
