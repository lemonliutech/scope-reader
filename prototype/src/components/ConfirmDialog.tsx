import { X } from "@phosphor-icons/react";

type ConfirmDialogProps = {
  book: { title: string } | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({ book, onCancel, onConfirm }: ConfirmDialogProps) {
  if (!book) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="dialog-close" type="button" aria-label="关闭" onClick={onCancel}>
          <X size={20} />
        </button>
        <h2 id="delete-title">删除《{book.title}》？</h2>
        <p>这会移除浏览器中的图书记录和阅读进度，不会删除原始文件。</p>
        <div className="dialog-actions">
          <button type="button" onClick={onCancel}>取消</button>
          <button className="danger-button" type="button" onClick={onConfirm}>删除</button>
        </div>
      </section>
    </div>
  );
}
