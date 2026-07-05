import type { LoaderResult } from "@/lib/accepted-inputs";
import { selectVisualization } from "@/lib/select-visualization";
import { buildGraphPlot } from "@/lib/graph-plot";
import { makeSuggestedVisualization } from "@/lib/suggested-visualization";
import type { SheetDatasetProfile } from "@/lib/input-preprocessing-types";
import { VisualizationPanel } from "./VisualizationPanel";

type LoaderResultPanelProps = {
  result: LoaderResult | null;
};

export function LoaderResultPanel({ result }: LoaderResultPanelProps) {
  if (!result || result.status !== "accepted") {
    return null;
  }

  const decision = selectVisualization(result.preprocessing);
  const dataset = result.preprocessing?.kind === "sheets" ? bestDataset(result.preprocessing.datasets) : undefined;
  const suggestedVisualization = makeSuggestedVisualization(decision, dataset);
  const graphPlot = buildGraphPlot(dataset, suggestedVisualization);

  return <VisualizationPanel plot={graphPlot} />;
}

function bestDataset(datasets: SheetDatasetProfile[]) {
  return [...datasets].sort((left, right) => {
    const leftScore = left.rowCount * Math.max(left.columnCount, 1);
    const rightScore = right.rowCount * Math.max(right.columnCount, 1);

    return rightScore - leftScore;
  })[0];
}
