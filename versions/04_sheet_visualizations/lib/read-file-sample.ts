import { BASIC_LOADER_LIMITS } from "./accepted-inputs";

export function readFileSample(file: File) {
  const sample = file.slice(0, BASIC_LOADER_LIMITS.maxFileSampleBytes);

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    });

    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("File read failed"));
    });

    reader.readAsText(sample);
  });
}
