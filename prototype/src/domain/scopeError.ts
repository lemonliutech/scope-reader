export type ImportStage =
  | "READ_FILE"
  | "DETECT_FORMAT"
  | "INSPECT_PUBLICATION"
  | "CHECK_CAPABILITIES"
  | "PREPARE_PUBLICATION"
  | "PERSIST_PUBLICATION"
  | "OPEN_READER";

export type ReaderStage =
  | "LOAD_CHAPTER"
  | "RENDER_CHAPTER"
  | "SAVE_LOCATION"
  | "DISPOSE_SESSION";

export type StorageStage =
  | "OPEN_DATABASE"
  | "READ_DATABASE"
  | "WRITE_DATABASE"
  | "DELETE_DATABASE";

export type ScopeErrorCode =
  | "FILE_NOT_SELECTED" | "FILE_TYPE_INVALID" | "FILE_EMPTY" | "FILE_TOO_LARGE"
  | "FILE_READ_DENIED" | "FILE_READ_ABORTED" | "DUPLICATE_BOOK"
  | "FORMAT_UNSUPPORTED" | "FORMAT_MISMATCH" | "FORMAT_ENGINE_NOT_FOUND" | "UNSUPPORTED_ENGINE_CAPABILITY"
  | "ZIP_INVALID" | "ZIP_BOMB_SUSPECTED" | "MIMETYPE_MISSING" | "MIMETYPE_INVALID"
  | "CONTAINER_XML_MISSING" | "CONTAINER_XML_INVALID"
  | "PACKAGE_DOCUMENT_MISSING" | "PACKAGE_DOCUMENT_INVALID" | "MANIFEST_INVALID"
  | "SPINE_EMPTY" | "SPINE_REFERENCE_MISSING" | "NAVIGATION_INVALID"
  | "UNSUPPORTED_EPUB_VERSION" | "UNSUPPORTED_FIXED_LAYOUT" | "UNSUPPORTED_SCRIPT_REQUIRED"
  | "UNSUPPORTED_DRM" | "UNSUPPORTED_ENCRYPTION" | "UNSUPPORTED_MEDIA_TYPE"
  | "RESOURCE_MISSING" | "RESOURCE_DECODE_FAILED" | "CONTENT_DOCUMENT_INVALID" | "ANCHOR_NOT_FOUND"
  | "RENDER_TARGET_MISSING" | "RENDER_INITIALIZATION_FAILED" | "RENDER_RUNTIME_FAILED" | "LOCATION_INVALID"
  | "INDEXEDDB_UNAVAILABLE" | "STORAGE_QUOTA_EXCEEDED" | "STORAGE_TRANSACTION_ABORTED"
  | "STORAGE_CORRUPTED" | "BOOK_PERSIST_FAILED" | "PROGRESS_PERSIST_FAILED" | "BOOK_DELETE_FAILED"
  | "ENGINE_LOAD_FAILED" | "ENGINE_DISPOSE_FAILED" | "BROWSER_UNSUPPORTED" | "OUT_OF_MEMORY"
  | "OPERATION_ABORTED" | "UNKNOWN_ERROR";

export interface ScopeIssue {
  code: ScopeErrorCode;
  stage: ImportStage | ReaderStage | StorageStage;
  userMessage: string;
  suggestion: string;
  blocking: boolean;
  details?: Record<string, unknown>;
}

type IssueCopy = Pick<ScopeIssue, "userMessage" | "suggestion">;

export const ISSUE_COPY = {
  FILE_NOT_SELECTED: { userMessage: "尚未选择要导入的文件。", suggestion: "请选择一个 EPUB 文件后重试。" },
  FILE_TYPE_INVALID: { userMessage: "所选文件的类型不是有效的 EPUB。", suggestion: "请选择扩展名和媒体类型均正确的 EPUB 文件。" },
  FILE_EMPTY: { userMessage: "所选文件没有任何内容。", suggestion: "请重新下载或选择非空的 EPUB 文件。" },
  FILE_TOO_LARGE: { userMessage: "文件大小超过当前允许的上限。", suggestion: "请压缩图书资源或选择体积更小的 EPUB。" },
  FILE_READ_DENIED: { userMessage: "浏览器没有权限读取该文件。", suggestion: "请重新选择文件并允许浏览器访问。" },
  FILE_READ_ABORTED: { userMessage: "文件读取在完成前被中断。", suggestion: "请保持页面打开并重新导入文件。" },
  DUPLICATE_BOOK: { userMessage: "书库中已存在相同的图书。", suggestion: "请打开已有图书，或删除旧版本后再导入。" },
  FORMAT_UNSUPPORTED: { userMessage: "当前不支持这类出版物格式。", suggestion: "请转换为标准 EPUB 后再导入。" },
  FORMAT_MISMATCH: { userMessage: "文件内容与声明的格式不一致。", suggestion: "请确认文件未被错误改名，并获取正确版本。" },
  FORMAT_ENGINE_NOT_FOUND: { userMessage: "找不到能够打开该出版物的格式引擎。", suggestion: "请确认文件是有效 EPUB，或更新阅读器后重试。" },
  UNSUPPORTED_ENGINE_CAPABILITY: { userMessage: "当前格式引擎缺少打开此书所需的能力。", suggestion: "请使用支持该特性的阅读器版本。" },
  ZIP_INVALID: { userMessage: "EPUB 压缩容器已损坏或不是有效 ZIP。", suggestion: "请重新下载文件或使用 EPUB 校验工具修复。" },
  ZIP_BOMB_SUSPECTED: { userMessage: "压缩内容的展开规模存在安全风险。", suggestion: "请仅使用可信来源的 EPUB，并检查压缩包内容。" },
  MIMETYPE_MISSING: { userMessage: "EPUB 容器缺少必需的 mimetype 文件。", suggestion: "请用 EPUB 制作工具重新打包图书。" },
  MIMETYPE_INVALID: { userMessage: "EPUB 的 mimetype 声明无效。", suggestion: "请将 mimetype 修正为 application/epub+zip。" },
  CONTAINER_XML_MISSING: { userMessage: "EPUB 缺少 META-INF/container.xml。", suggestion: "请重新导出包含标准容器描述的 EPUB。" },
  CONTAINER_XML_INVALID: { userMessage: "EPUB 容器描述文件无法解析。", suggestion: "请修复 container.xml 的 XML 结构和根文件路径。" },
  PACKAGE_DOCUMENT_MISSING: { userMessage: "找不到 EPUB 的包文档。", suggestion: "请检查 container.xml 指向的 OPF 文件是否存在。" },
  PACKAGE_DOCUMENT_INVALID: { userMessage: "EPUB 包文档内容无效。", suggestion: "请修复 OPF 的 XML、命名空间及必需字段。" },
  MANIFEST_INVALID: { userMessage: "EPUB 资源清单不完整或存在无效条目。", suggestion: "请修复 manifest 中资源的 id、href 和媒体类型。" },
  SPINE_EMPTY: { userMessage: "EPUB 阅读顺序为空。", suggestion: "请在 OPF spine 中加入至少一个可阅读内容项。" },
  SPINE_REFERENCE_MISSING: { userMessage: "阅读顺序引用了不存在的清单资源。", suggestion: "请修复 spine 的 idref，使其对应有效 manifest 条目。" },
  NAVIGATION_INVALID: { userMessage: "图书目录缺失或无法完整解析。", suggestion: "仍可按阅读顺序阅读；建议修复导航文档链接。" },
  UNSUPPORTED_EPUB_VERSION: { userMessage: "该 EPUB 版本不在当前支持范围内。", suggestion: "请将图书转换为受支持的 EPUB 版本。" },
  UNSUPPORTED_FIXED_LAYOUT: { userMessage: "当前阅读器不支持固定版式 EPUB。", suggestion: "请使用支持固定版式的阅读器或获取流式版本。" },
  UNSUPPORTED_SCRIPT_REQUIRED: { userMessage: "图书必须运行脚本才能呈现关键内容。", suggestion: "请获取不依赖脚本的版本或使用受信任的兼容阅读器。" },
  UNSUPPORTED_DRM: { userMessage: "图书受当前无法处理的 DRM 保护。", suggestion: "请通过授权平台阅读，或获取无 DRM 的合法副本。" },
  UNSUPPORTED_ENCRYPTION: { userMessage: "图书资源采用了不支持的加密方式。", suggestion: "请使用具备相应解密能力的授权阅读器。" },
  UNSUPPORTED_MEDIA_TYPE: { userMessage: "图书包含当前无法呈现的媒体类型。", suggestion: "请将相关资源转换为浏览器支持的格式。" },
  RESOURCE_MISSING: { userMessage: "图书引用的部分资源不存在。", suggestion: "正文可继续时请忽略缺失项，否则修复资源路径后重新导入。" },
  RESOURCE_DECODE_FAILED: { userMessage: "图书中的资源无法解码。", suggestion: "请检查资源编码，或替换损坏的图片、字体或媒体文件。" },
  CONTENT_DOCUMENT_INVALID: { userMessage: "章节内容文档格式无效。", suggestion: "请修复对应 XHTML/HTML 的标记和字符编码。" },
  ANCHOR_NOT_FOUND: { userMessage: "目标章节中找不到指定锚点。", suggestion: "已定位到章节起始处；建议修复目录或内部链接。" },
  RENDER_TARGET_MISSING: { userMessage: "找不到用于显示章节的页面区域。", suggestion: "请刷新阅读器页面后重新打开图书。" },
  RENDER_INITIALIZATION_FAILED: { userMessage: "章节渲染环境初始化失败。", suggestion: "请刷新页面，关闭浏览器扩展后重试。" },
  RENDER_RUNTIME_FAILED: { userMessage: "章节在显示过程中发生运行错误。", suggestion: "请切换章节或刷新页面；若持续出现，请检查图书内容。" },
  LOCATION_INVALID: { userMessage: "保存的阅读位置已经无效。", suggestion: "将从可用章节开头继续阅读并重新保存进度。" },
  INDEXEDDB_UNAVAILABLE: { userMessage: "浏览器本地数据库不可用。", suggestion: "请退出隐私限制模式，并允许网站使用本地存储。" },
  STORAGE_QUOTA_EXCEEDED: { userMessage: "浏览器本地存储空间不足。", suggestion: "请删除不需要的图书或释放浏览器存储空间。" },
  STORAGE_TRANSACTION_ABORTED: { userMessage: "本地数据库事务在完成前被终止。", suggestion: "请保持页面打开并重试刚才的操作。" },
  STORAGE_CORRUPTED: { userMessage: "本地图书数据已损坏。", suggestion: "请备份可用数据，清理本站存储后重新导入。" },
  BOOK_PERSIST_FAILED: { userMessage: "图书未能保存到本地书库。", suggestion: "请检查存储权限和剩余空间后重新导入。" },
  PROGRESS_PERSIST_FAILED: { userMessage: "阅读进度未能保存。", suggestion: "请检查本地存储状态，并在离开页面前重试。" },
  BOOK_DELETE_FAILED: { userMessage: "无法从本地书库删除该图书。", suggestion: "请关闭正在阅读的会话后再次删除。" },
  ENGINE_LOAD_FAILED: { userMessage: "出版物引擎加载失败。", suggestion: "请刷新页面或更新浏览器后重新打开图书。" },
  ENGINE_DISPOSE_FAILED: { userMessage: "阅读会话资源未能完全释放。", suggestion: "请刷新页面以清理残留资源。" },
  BROWSER_UNSUPPORTED: { userMessage: "当前浏览器缺少阅读器所需功能。", suggestion: "请升级或改用最新版本的主流浏览器。" },
  OUT_OF_MEMORY: { userMessage: "处理图书时可用内存不足。", suggestion: "请关闭其他页面，重新打开浏览器后尝试较小的图书。" },
  OPERATION_ABORTED: { userMessage: "操作已在完成前取消。", suggestion: "如需继续，请重新执行该操作。" },
  UNKNOWN_ERROR: { userMessage: "阅读器遇到未识别的错误。", suggestion: "请保留错误详情，刷新页面后重试并向维护者反馈。" },
} satisfies Record<ScopeErrorCode, IssueCopy>;

export class ScopeException extends Error {
  readonly issues: readonly ScopeIssue[];

  constructor(issues: readonly ScopeIssue[], options?: ErrorOptions) {
    super(issues.map(({ userMessage }) => userMessage).join("\n"), options);
    this.name = "ScopeException";
    this.issues = [...issues];
  }
}

export function issue(
  code: ScopeErrorCode,
  stage: ScopeIssue["stage"],
  blocking: boolean,
  details?: Record<string, unknown>,
): ScopeIssue {
  return { code, stage, blocking, ...ISSUE_COPY[code], ...(details === undefined ? {} : { details }) };
}

export function blockingIssues(issues: readonly ScopeIssue[]): ScopeIssue[] {
  return issues.filter(({ blocking }) => blocking);
}
