export type WidenLiteral<T> =
  T extends (...args: infer Args) => infer Result ? (...args: Args) => Result
  : T extends readonly (infer Item)[] ? readonly WidenLiteral<Item>[]
  : T extends object ? {
      readonly [Key in keyof T]:
        Key extends "value" ? T[Key] : WidenLiteral<T[Key]>;
    }
  : T extends string ? string
  : T extends number ? number
  : T extends boolean ? boolean
  : T;
