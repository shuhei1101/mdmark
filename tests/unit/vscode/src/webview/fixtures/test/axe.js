// audit のテストの axe-core の代役。`run` に渡った範囲を控え、違反 1 件を返す
globalThis.__mdmarkAxeRuns = [];
globalThis.axe = {
  run: async (context) => {
    globalThis.__mdmarkAxeRuns.push(context);
    return {
      violations: [
        {
          id: "color-contrast",
          impact: "serious",
          nodes: [{ target: ["#a"] }],
        },
      ],
    };
  },
};
