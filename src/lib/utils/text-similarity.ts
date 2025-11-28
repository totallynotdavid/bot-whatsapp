export function calculateSimilarity(first: string, second: string): number {
  const longer = first.length > second.length ? first : second;
  const shorter = first.length > second.length ? second : first;

  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(first: string, second: string): number {
  const matrix: number[][] = Array.from({ length: second.length + 1 }, () =>
    new Array(first.length + 1).fill(0)
  );

  for (let i = 0; i <= second.length; i++) {
    matrix[i]![0] = i;
  }

  for (let j = 0; j <= first.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= second.length; i++) {
    for (let j = 1; j <= first.length; j++) {
      const cost = second[i - 1] === first[j - 1] ? 0 : 1;

      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost
      );
    }
  }

  return matrix[second.length]![first.length]!;
}
