// Remark-Plugin: einfache Zeilenumbrüche (single \n) als harte Zeilenumbrüche (break)
// behandeln, damit Zeilenumbrüche und leere Zeilen in der Vorschau/Anzeige
// sichtbar bleiben. Leere Zeilen (\n\n) werden vom Parser als Absatzumbrüche
// behandelt.
type MdNode = { type?: string; value?: string; children?: MdNode[] };

export function remarkLineBreaks() {
  return (tree: MdNode) => {
    const transform = (node: MdNode) => {
      if (!node || !Array.isArray(node.children)) return;
      const next: MdNode[] = [];
      for (const child of node.children) {
        if (child && child.type === "text" && typeof child.value === "string" && /\n/.test(child.value)) {
          const parts = child.value.split("\n");
          parts.forEach((part, i) => {
            if (i > 0) next.push({ type: "break" });
            if (part !== "") next.push({ type: "text", value: part });
          });
        } else {
          transform(child);
          next.push(child);
        }
      }
      node.children = next;
    };
    transform(tree);
  };
}