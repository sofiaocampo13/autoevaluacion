import { buildEvidencePackage, loadEvidence } from "../src/lib/evidence";
async function main() {
  for (const url of ["https://github.com/octocat/Hello-World", "https://github.com/octocat/no-existe-este-repo-xyz"]) {
    const { items, problems } = await loadEvidence({ files: [], repoUrl: url, download: async () => null });
    const pkg = buildEvidencePackage(items, problems);
    console.log(url, "→", pkg.inventory.map((i) => `${i.location} [${i.mode}]${i.note ? " " + i.note : ""}`));
  }
}
main().catch((e) => console.error("FALLÓ", e.message));
