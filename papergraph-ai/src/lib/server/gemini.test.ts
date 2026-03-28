import { describe, expect, it } from "vitest";
import {
  buildHeuristicPaperConnections,
  buildPaperConnectionCandidates,
} from "@/lib/server/gemini";

type PaperAnalyses = Parameters<typeof buildHeuristicPaperConnections>[0];

function buildPaper(
  overrides: Partial<PaperAnalyses[number]>
): PaperAnalyses[number] {
  return {
    paperLabel: "Paper 1",
    title: "Untitled Paper",
    titleEvidence: "Untitled Paper",
    displayLabel: "Untitled",
    themeLabel: "General topic",
    themeDescription: "",
    summary: "General research summary.",
    evidence: "",
    ...overrides,
  };
}

describe("buildHeuristicPaperConnections", () => {
  it("creates a paper edge when two papers share a research theme", () => {
    const papers: PaperAnalyses = [
      buildPaper({
        paperLabel: "Paper 1",
        title: "Epigenetic Aging Clocks for Clinical Biomarkers",
        displayLabel: "Aging Clocks",
        themeLabel: "DNA aging",
        themeDescription: "DNA aging papers measure biological age from methylation signals.",
        summary: "This paper develops methylation-based predictors for biological aging.",
        evidence: "We derive methylation predictors for biological age.",
      }),
      buildPaper({
        paperLabel: "Paper 2",
        title: "Methylation Signatures of Accelerated Aging",
        displayLabel: "Aging Signatures",
        themeLabel: "DNA aging",
        themeDescription: "DNA aging papers measure biological age from methylation signals.",
        summary: "This paper studies methylation patterns linked to accelerated aging.",
        evidence: "Accelerated aging is associated with methylation signatures.",
      }),
    ];

    const edges = buildHeuristicPaperConnections(papers);

    expect(edges).toHaveLength(1);
    expect(edges[0]?.relation).toBe("shares research focus with");
    expect(edges[0]?.source).toBe("Epigenetic Aging Clocks for Clinical Biomarkers");
    expect(edges[0]?.target).toBe("Methylation Signatures of Accelerated Aging");
  });

  it("backfills a paper edge from shared keywords when Gemini misses the pair", () => {
    const papers: PaperAnalyses = [
      buildPaper({
        paperLabel: "Paper 1",
        title: "Graph Neural Networks for Drug Discovery",
        displayLabel: "Drug Graphs",
        themeLabel: "molecular discovery",
        summary: "Graph neural networks predict molecular properties for drug discovery workflows.",
        evidence: "We use graph neural networks to predict molecular properties.",
      }),
      buildPaper({
        paperLabel: "Paper 2",
        title: "Molecular Property Prediction with Sparse Graph Models",
        displayLabel: "Sparse Molecules",
        themeLabel: "property modeling",
        summary: "Sparse graph models improve molecular property prediction in screening pipelines.",
        evidence: "Molecular property prediction improves with sparse graph models.",
      }),
    ];

    const edges = buildHeuristicPaperConnections(papers);

    expect(edges).toHaveLength(1);
    expect(edges[0]?.relation).toBe("overlaps with");
    expect(edges[0]?.evidence).toContain("Shared terms");
  });

  it("does not duplicate a pair that already has a paper-to-paper edge", () => {
    const papers: PaperAnalyses = [
      buildPaper({
        paperLabel: "Paper 1",
        title: "Federated Learning for Hospital Imaging",
        displayLabel: "Hospital FL",
        themeLabel: "federated imaging",
        summary: "Federated learning improves hospital imaging collaboration.",
      }),
      buildPaper({
        paperLabel: "Paper 2",
        title: "Privacy-Preserving Imaging Models Across Clinics",
        displayLabel: "Clinic Privacy",
        themeLabel: "federated imaging",
        summary: "Privacy-preserving models support imaging across clinics.",
      }),
    ];

    const edges = buildHeuristicPaperConnections(papers, [
      {
        source: "Federated Learning for Hospital Imaging",
        target: "Privacy-Preserving Imaging Models Across Clinics",
        relation: "aligns with",
        explanation: "Existing Gemini edge.",
        evidence: "Existing evidence.",
      },
    ]);

    expect(edges).toEqual([]);
  });
});

describe("buildPaperConnectionCandidates", () => {
  it("shortlists overlapping paper pairs and skips already-connected pairs", () => {
    const papers: PaperAnalyses = [
      buildPaper({
        paperLabel: "Paper 1",
        title: "Graph Neural Networks for Drug Discovery",
        displayLabel: "Drug Graphs",
        themeLabel: "molecular discovery",
        summary: "Graph neural networks predict molecular properties for drug discovery workflows.",
      }),
      buildPaper({
        paperLabel: "Paper 2",
        title: "Molecular Property Prediction with Sparse Graph Models",
        displayLabel: "Sparse Molecules",
        themeLabel: "property modeling",
        summary: "Sparse graph models improve molecular property prediction in screening pipelines.",
      }),
      buildPaper({
        paperLabel: "Paper 3",
        title: "Orbit Determination for Deep-Space Navigation",
        displayLabel: "Deep Space",
        themeLabel: "space navigation",
        summary: "Probabilistic orbit determination improves deep-space navigation accuracy.",
      }),
    ];

    const candidates = buildPaperConnectionCandidates(papers, [
      {
        source: "Graph Neural Networks for Drug Discovery",
        target: "Molecular Property Prediction with Sparse Graph Models",
        relation: "aligns with",
        explanation: "Existing connection.",
        evidence: "Existing evidence.",
      },
    ]);

    expect(candidates).toEqual([]);
  });

  it("keeps the single pair for two-paper uploads so Gemini can still judge contrast", () => {
    const papers: PaperAnalyses = [
      buildPaper({
        paperLabel: "Paper 1",
        title: "Adaptive Robotics in Warehouses",
        themeLabel: "robotics",
        summary: "Warehouse robots adapt to changing layouts.",
      }),
      buildPaper({
        paperLabel: "Paper 2",
        title: "Protein Folding with Diffusion Models",
        themeLabel: "protein design",
        summary: "Diffusion models improve protein folding predictions.",
      }),
    ];

    const candidates = buildPaperConnectionCandidates(papers);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.leftTitle).toBe("Adaptive Robotics in Warehouses");
    expect(candidates[0]?.rightTitle).toBe("Protein Folding with Diffusion Models");
  });
});
