import { MathSum } from "./index";

test("should be throw error number is required", () => {
  try {
    MathSum();
  } catch (err: Error | any) {
    expect(err.message).toBe("numbers are required");
  }
});

test("should be return sum of number", () => {
  const num1 = 10;
  const num2 = 20;
  const num3 = 30;

  const sum = MathSum(num1, num2, num3);

  expect(sum).toBe(num1 + num2 + num3);
});
