export const MathSum = (...nums: number[]): number => {
  if (nums.length === 0) {
    throw new Error("numbers are required");
  }

  return nums.reduce((acc, num) => acc + num, 0);
};
