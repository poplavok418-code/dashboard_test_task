declare module "papaparse" {
  const Papa: {
    parse: (input: string, config?: Record<string, unknown>) => {
      data: unknown[];
      errors: Array<{ message: string; row?: number; code?: string }>;
      meta: { delimiter?: string };
    };
  };

  export default Papa;
}
