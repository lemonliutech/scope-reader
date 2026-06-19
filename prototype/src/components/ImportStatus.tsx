import type { ImportProgress } from "../services/ReaderService";

const STAGE_LABEL_MAP: Record<ImportProgress["stage"], string> = {
  READ_FILE: "读取文件",
  DETECT_FORMAT: "识别格式",
  INSPECT_PUBLICATION: "解析出版物",
  CHECK_CAPABILITIES: "检查兼容性",
  PREPARE_PUBLICATION: "准备引擎",
  PERSIST_PUBLICATION: "保存到书库",
  OPEN_READER: "打开阅读器",
};

type ImportStatusProps = { progress: ImportProgress | null };

export function ImportStatus({ progress }: ImportStatusProps) {
  const label = progress ? STAGE_LABEL_MAP[progress.stage] : "正在处理…";
  return (
    <div className="import-status" role="status" aria-live="polite">
      <span className="import-spinner" aria-hidden="true" />
      {label}
    </div>
  );
}
