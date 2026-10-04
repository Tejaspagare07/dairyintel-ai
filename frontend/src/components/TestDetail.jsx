import Modal from "./Modal";
import { QualityCard, HealthCard } from "./ResultCards";

const READINGS = [["fat", "Fat", "%"], ["snf", "SNF", "%"], ["clr", "CLR", ""], ["protein", "Protein", "%"], ["lactose", "Lactose", "%"], ["addedWater", "Added water", "%"], ["temp", "Temp", "°C"], ["ec", "EC", "mS/cm"], ["scc", "SCC", "cells/mL"]];

export default function TestDetail({ test, onClose }) {
  if (!test) return null;
  return (
    <Modal open={!!test} onClose={onClose} title={`Test ${test.testNo || ""} · ${test.shift || ""}`} wide>
      <p className="muted small" style={{ marginTop: 0 }}>
        {new Date(test.testedAt).toLocaleString()}
        {test.animalId?.animalId && <> · {test.animalId.animalId}{test.animalId.name ? ` (${test.animalId.name})` : ""}</>}
        {test.userId?.name && <> · {test.userId.name}</>}
      </p>
      <div className="readings">
        {READINGS.map(([k, l, u]) => (
          <div key={k} className="rd"><span>{l}</span><b>{test[k] ?? "—"}{test[k] != null && u ? ` ${u}` : ""}</b></div>
        ))}
      </div>
      <div className="grid-2b" style={{ marginTop: "1rem", marginBottom: 0 }}>
        <QualityCard q={test.quality} />
        <HealthCard d={test.disease} />
      </div>
    </Modal>
  );
}
