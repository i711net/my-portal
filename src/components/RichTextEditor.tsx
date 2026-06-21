"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Extension, Mark, mergeAttributes, Node, type Editor as TiptapEditor } from "@tiptap/core";
import TiptapImage from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

type RichTextEditorProps = {
  content: string;
  insertRequest?: {
    id: string;
    type: "image" | "video" | "audio";
    url: string;
  } | null;
  labels: {
    paragraph: string;
    heading1: string;
    heading2: string;
    heading3: string;
    bold: string;
    italic: string;
    strike: string;
    inlineCode: string;
    quote: string;
    code: string;
    bulletList: string;
    orderedList: string;
    link: string;
    unlink: string;
    image: string;
    imageUpload: string;
    imageUploading: string;
    imageSmall: string;
    imageMedium: string;
    imageFull: string;
    imageCustom: string;
    imageWidthPrompt: string;
    imageCaption: string;
    imageAlignLeft: string;
    imageAlignCenter: string;
    imageAlignRight: string;
    textColor: string;
    highlightColor: string;
    fontSize: string;
    fontFamily: string;
    alignLeft: string;
    alignCenter: string;
    alignRight: string;
    insertTable: string;
    tableAddRow: string;
    tableAddColumn: string;
    tableDeleteRow: string;
    tableDeleteColumn: string;
    tableDeleteTable: string;
    tableMergeRight: string;
    tableSplitCell: string;
    tableToggleWidth: string;
    findReplace: string;
    fullScreen: string;
    exitFullScreen: string;
    autosaved: string;
    video: string;
    audio: string;
    divider: string;
    deleteDivider: string;
    lineBreak: string;
    clearFormat: string;
    undo: string;
    redo: string;
    placeholder: string;
  };
  onUploadFile?: (file: File) => Promise<string>;
  onChange: (html: string, text: string) => void;
};

type ImageCommandAttrs = {
  src: string;
  alt?: string;
  title?: string;
  caption?: string;
  align?: string;
};

type TableContext = {
  tableDepth: number;
  rowDepth: number;
  cellDepth: number;
  tablePos: number;
  tableNode: ProseMirrorNode;
  rowIndex: number;
  cellIndex: number;
  colspan: number;
};

function imageAttrs(src: string, width = "70%") {
  return { src, width } as ImageCommandAttrs;
}

const fontSizeOptions = [
  { label: "12px", value: "12px" },
  { label: "14px", value: "14px" },
  { label: "16px", value: "16px" },
  { label: "18px", value: "18px" },
  { label: "22px", value: "22px" },
  { label: "28px", value: "28px" },
  { label: "36px", value: "36px" },
];

const fontFamilyOptions = [
  { label: "Default", value: "" },
  { label: "微软雅黑", value: '"Microsoft YaHei", "PingFang SC", Arial, sans-serif' },
  { label: "宋体", value: 'SimSun, "Songti SC", serif' },
  { label: "楷体", value: 'KaiTi, "Kaiti SC", serif' },
  { label: "仿宋", value: 'FangSong, serif' },
  { label: "等线", value: 'DengXian, "Microsoft YaHei", sans-serif' },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
];

const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "video" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["video", mergeAttributes(HTMLAttributes, { controls: "true", class: "w-full rounded-lg bg-slate-950" })];
  },
});

const Audio = Node.create({
  name: "audio",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "audio" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["audio", mergeAttributes(HTMLAttributes, { controls: "true", class: "w-full" })];
  },
});

const ResizableImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      width: {
        default: "70%",
        parseHTML: (element) => element.style.width || element.getAttribute("width") || "70%",
        renderHTML: (attributes) => {
          if (!attributes.width) {
            return {};
          }

          return {
            style: `width: ${attributes.width}; height: auto;`,
          };
        },
      },
      caption: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-caption") || element.getAttribute("alt") || "",
        renderHTML: (attributes) => (attributes.caption ? { "data-caption": attributes.caption, alt: attributes.caption } : {}),
      },
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align") || "center",
        renderHTML: (attributes) => (attributes.align ? { "data-align": attributes.align } : {}),
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const caption = String(HTMLAttributes["data-caption"] || "");
    const align = String(HTMLAttributes["data-align"] || "center");
    const justify = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
    const imgAttributes = { ...HTMLAttributes };

    delete imgAttributes["data-caption"];
    delete imgAttributes["data-align"];

    const children: unknown[] = [
      "figure",
      { "data-image-align": align, style: `display: flex; flex-direction: column; align-items: ${justify}; gap: 0.35rem; margin: 1rem 0;` },
      ["img", mergeAttributes(this.options.HTMLAttributes, imgAttributes)],
    ];

    if (caption) {
      children.push(["figcaption", { style: "font-size: 0.875rem; color: #64748b;" }, caption]);
    }

    return children as never;
  },
});

const StyleMark = Mark.create({
  name: "styleMark",

  addAttributes() {
    return {
      color: { default: null },
      backgroundColor: { default: null },
      fontSize: { default: null },
      fontFamily: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span",
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) {
            return false;
          }

          return {
            color: element.style.color || null,
            backgroundColor: element.style.backgroundColor || null,
            fontSize: element.style.fontSize || null,
            fontFamily: element.style.fontFamily || null,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const styles = [
      HTMLAttributes.color ? `color: ${String(HTMLAttributes.color)}` : "",
      HTMLAttributes.backgroundColor ? `background-color: ${String(HTMLAttributes.backgroundColor)}` : "",
      HTMLAttributes.fontSize ? `font-size: ${String(HTMLAttributes.fontSize)}` : "",
      HTMLAttributes.fontFamily ? `font-family: ${String(HTMLAttributes.fontFamily)}` : "",
    ].filter(Boolean);

    return ["span", styles.length ? { style: styles.join("; ") } : {}, 0];
  },
});

const TextAlign = Extension.create({
  name: "textAlign",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element) => (element instanceof HTMLElement ? element.style.textAlign || null : null),
            renderHTML: (attributes) => (attributes.textAlign ? { style: `text-align: ${String(attributes.textAlign)}` } : {}),
          },
        },
      },
    ];
  },
});

const TableCellKeyboard = Extension.create({
  name: "tableCellKeyboard",

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const context = getTableContextFromEditor(this.editor);

        if (!context) {
          return false;
        }

        const { state, view } = this.editor;
        const { selection, schema } = state;
        const paragraph = schema.nodes.paragraph;

        if (!paragraph || !selection.empty) {
          return false;
        }

        const { $from } = selection;

        if ($from.parent.isTextblock && $from.parent.content.size > 0) {
          return this.editor.commands.splitBlock();
        }

        const insertPos = $from.after($from.depth);
        const transaction = state.tr.insert(insertPos, paragraph.create());
        transaction.setSelection(TextSelection.near(transaction.doc.resolve(insertPos + 1)));
        view.dispatch(transaction.scrollIntoView());
        view.focus();
        return true;
      },
      "Shift-Enter": () => {
        if (!getTableContextFromEditor(this.editor)) {
          return false;
        }

        return this.editor.commands.setHardBreak();
      },
    };
  },
});

const Table = Node.create({
  name: "table",
  group: "block",
  content: "tableRow+",

  addAttributes() {
    return {
      layout: {
        default: "fixed",
        parseHTML: (element) => (element instanceof HTMLElement ? element.getAttribute("data-layout") || "fixed" : "fixed"),
        renderHTML: (attributes) => ({
          "data-layout": attributes.layout || "fixed",
          style: `table-layout: ${attributes.layout === "auto" ? "auto" : "fixed"}; width: 100%;`,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "table" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["table", mergeAttributes(HTMLAttributes, { class: "editor-table" }), ["tbody", 0]];
  },
});

const TableRow = Node.create({
  name: "tableRow",
  content: "tableCell+",

  parseHTML() {
    return [{ tag: "tr" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["tr", mergeAttributes(HTMLAttributes), 0];
  },
});

const TableCell = Node.create({
  name: "tableCell",
  content: "block+",

  addAttributes() {
    return {
      colspan: {
        default: 1,
        parseHTML: (element) => Number(element.getAttribute("colspan") || 1),
        renderHTML: (attributes) => (Number(attributes.colspan) > 1 ? { colspan: attributes.colspan } : {}),
      },
      rowspan: {
        default: 1,
        parseHTML: (element) => Number(element.getAttribute("rowspan") || 1),
        renderHTML: (attributes) => (Number(attributes.rowspan) > 1 ? { rowspan: attributes.rowspan } : {}),
      },
      width: {
        default: null,
        parseHTML: (element) => (element instanceof HTMLElement ? element.style.width || null : null),
        renderHTML: (attributes) => (attributes.width ? { style: `width: ${String(attributes.width)};` } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "td" }, { tag: "th" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["td", mergeAttributes(HTMLAttributes), 0];
  },
});

function replaceTextInHtml(html: string, find: string, replacement: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();

  while (current) {
    current.textContent = current.textContent?.split(find).join(replacement) ?? "";
    current = walker.nextNode();
  }

  return doc.body.firstElementChild?.innerHTML ?? html;
}

function blankTableCellJson() {
  return {
    type: "tableCell",
    attrs: { colspan: 1, rowspan: 1, width: null },
    content: [{ type: "paragraph" }],
  };
}

function getTableContextFromEditor(editor: TiptapEditor): TableContext | null {
  const { $from } = editor.state.selection;
  let tableDepth = -1;
  let rowDepth = -1;
  let cellDepth = -1;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name;

    if (name === "tableCell" && cellDepth === -1) {
      cellDepth = depth;
    }

    if (name === "tableRow" && rowDepth === -1) {
      rowDepth = depth;
    }

    if (name === "table" && tableDepth === -1) {
      tableDepth = depth;
    }
  }

  if (tableDepth === -1 || rowDepth === -1 || cellDepth === -1) {
    return null;
  }

  return {
    tableDepth,
    rowDepth,
    cellDepth,
    tablePos: $from.before(tableDepth),
    tableNode: $from.node(tableDepth),
    rowIndex: $from.index(tableDepth),
    cellIndex: $from.index(rowDepth),
    colspan: Number($from.node(cellDepth).attrs.colspan || 1),
  };
}

function getTableCellTextPosition(tableNode: ProseMirrorNode, tablePos: number, rowIndex: number, cellIndex: number) {
  const safeRowIndex = Math.min(Math.max(rowIndex, 0), tableNode.childCount - 1);
  let rowPos = tablePos + 1;

  for (let row = 0; row < safeRowIndex; row += 1) {
    rowPos += tableNode.child(row).nodeSize;
  }

  const rowNode = tableNode.child(safeRowIndex);
  const safeCellIndex = Math.min(Math.max(cellIndex, 0), rowNode.childCount - 1);
  let cellPos = rowPos + 1;

  for (let cell = 0; cell < safeCellIndex; cell += 1) {
    cellPos += rowNode.child(cell).nodeSize;
  }

  return cellPos + 2;
}

export function RichTextEditor({ content, insertRequest, labels, onUploadFile, onChange }: RichTextEditorProps) {
  const [selectedImage, setSelectedImage] = useState(false);
  const [selectedDivider, setSelectedDivider] = useState(false);
  const [selectedTable, setSelectedTable] = useState(false);
  const [canSplitTableCell, setCanSplitTableCell] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [tablePickerSize, setTablePickerSize] = useState({ rows: 3, cols: 3 });
  const [lastAutoSaved, setLastAutoSaved] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function syncSelectionState(currentEditor: TiptapEditor) {
    const tableContext = getTableContextFromEditor(currentEditor);

    setSelectedImage(currentEditor.isActive("image"));
    setSelectedDivider(currentEditor.isActive("horizontalRule"));
    setSelectedTable(Boolean(tableContext));
    setCanSplitTableCell(Boolean(tableContext && tableContext.colspan > 1));
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      ResizableImage.configure({
        allowBase64: false,
      }),
      StyleMark,
      TextAlign,
      TableCellKeyboard,
      Table,
      TableRow,
      TableCell,
      Video,
      Audio,
      Placeholder.configure({
        placeholder: labels.placeholder,
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          "rich-editor-content min-h-[560px] px-8 py-7 text-lg leading-8 text-slate-800 outline-none prose-editor",
      },
      handleClickOn(view, _pos, node, nodePos) {
        if (node.type.name !== "image" && node.type.name !== "horizontalRule") {
          return false;
        }

        const transaction = view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos));
        view.dispatch(transaction);
        setSelectedImage(node.type.name === "image");
        setSelectedDivider(node.type.name === "horizontalRule");
        return true;
      },
      handlePaste(_view, event) {
        const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith("image/"));

        if (!file || !onUploadFile) {
          return false;
        }

        void uploadImageFile(file);
        return true;
      },
      handleDrop(_view, event) {
        const file = Array.from(event.dataTransfer?.files ?? []).find((item) => item.type.startsWith("image/"));

        if (!file || !onUploadFile) {
          return false;
        }

        event.preventDefault();
        void uploadImageFile(file);
        return true;
      },
    },
    onUpdate({ editor: currentEditor }) {
      syncSelectionState(currentEditor);
      setLastAutoSaved(new Date().toLocaleTimeString());
      onChange(currentEditor.getHTML(), currentEditor.getText());
    },
    onSelectionUpdate({ editor: currentEditor }) {
      syncSelectionState(currentEditor);
    },
  });

  useEffect(() => {
    if (!editor || editor.getHTML() === content) {
      return;
    }

    editor.commands.setContent(content);
  }, [content, editor]);

  useEffect(() => {
    if (!editor || !insertRequest?.url) {
      return;
    }

    if (insertRequest.type === "image") {
      editor.chain().focus().setImage(imageAttrs(insertRequest.url)).createParagraphNear().run();
      return;
    }

    editor
      .chain()
      .focus()
      .insertContent({ type: insertRequest.type, attrs: { src: insertRequest.url } })
      .createParagraphNear()
      .run();
  }, [editor, insertRequest]);

  if (!editor) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="rich-editor-content min-h-[560px] p-8 text-slate-500">{labels.placeholder}</div>
      </div>
    );
  }

  const activeEditor = editor;

  function setLink() {
    const previousUrl = activeEditor.getAttributes("link").href as string | undefined;
    const url = window.prompt(labels.link, previousUrl ?? "https://");

    if (url === null) {
      return;
    }

    if (!url) {
      activeEditor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    activeEditor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function insertImage() {
    const url = window.prompt(labels.image, "https://");

    if (!url) {
      return;
    }

    activeEditor.chain().focus().setImage(imageAttrs(url)).run();
  }

  async function uploadImageFile(file: File) {
    if (!editor || !onUploadFile || !file.type.startsWith("image/")) {
      return;
    }

    setIsUploadingImage(true);

    try {
      const url = await onUploadFile(file);

      if (url) {
        activeEditor.chain().focus().setImage(imageAttrs(url)).createParagraphNear().run();
      }
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function insertMedia(type: "video" | "audio", label: string) {
    const url = window.prompt(label, "https://");

    if (!url) {
      return;
    }

    activeEditor.chain().focus().insertContent({ type, attrs: { src: url } }).createParagraphNear().run();
  }

  function setStyleMark(attrs: { color?: string; backgroundColor?: string; fontSize?: string; fontFamily?: string }) {
    activeEditor.chain().focus().setMark("styleMark", attrs).run();
  }

  function clearStyleMark() {
    activeEditor.chain().focus().unsetMark("styleMark").run();
  }

  function setTextAlign(textAlign: "left" | "center" | "right") {
    if (activeEditor.isActive("heading")) {
      activeEditor.chain().focus().updateAttributes("heading", { textAlign }).run();
      return;
    }

    activeEditor.chain().focus().updateAttributes("paragraph", { textAlign }).run();
  }

  function insertTable(rows = 3, cols = 3) {
    setTablePickerOpen(false);
    activeEditor
      .chain()
      .focus()
      .insertContent({
        type: "table",
        content: Array.from({ length: rows }, () => ({
          type: "tableRow",
          content: Array.from({ length: cols }, () => ({
            type: "tableCell",
            content: [{ type: "paragraph" }],
          })),
        })),
      })
      .run();
  }

  function getTableContext() {
    return getTableContextFromEditor(activeEditor);
  }

  function replaceTable(mutator: (tableJson: { attrs?: Record<string, unknown>; content?: Array<{ content?: unknown[] }> }, context: NonNullable<ReturnType<typeof getTableContext>>) => void) {
    const context = getTableContext();

    if (!context) {
      return;
    }

    const tableJson = context.tableNode.toJSON() as { attrs?: Record<string, unknown>; content?: Array<{ content?: unknown[] }> };
    tableJson.attrs = tableJson.attrs ?? {};
    tableJson.content = tableJson.content ?? [];
    mutator(tableJson, context);

    const nextTable = activeEditor.schema.nodeFromJSON(tableJson);
    const transaction = activeEditor.state.tr.replaceWith(context.tablePos, context.tablePos + context.tableNode.nodeSize, nextTable);
    const nextSelectionPos = Math.min(getTableCellTextPosition(nextTable, context.tablePos, context.rowIndex, context.cellIndex), transaction.doc.content.size);
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(nextSelectionPos)));
    activeEditor.view.dispatch(transaction);
    activeEditor.view.focus();
    const nextContext = getTableContextFromEditor(activeEditor);
    setSelectedTable(true);
    setCanSplitTableCell(Boolean(nextContext && nextContext.colspan > 1));
  }

  function addTableRow() {
    replaceTable((tableJson, context) => {
      const currentRow = tableJson.content?.[context.rowIndex];
      const cellCount = Math.max(1, currentRow?.content?.length ?? 1);
      const newRow = {
        type: "tableRow",
        content: Array.from({ length: cellCount }, blankTableCellJson),
      };

      tableJson.content?.splice(context.rowIndex + 1, 0, newRow);
    });
  }

  function addTableColumn() {
    replaceTable((tableJson, context) => {
      tableJson.content?.forEach((row) => {
        row.content = row.content ?? [];
        row.content.splice(context.cellIndex + 1, 0, blankTableCellJson());
      });
    });
  }

  function deleteTableRow() {
    const context = getTableContext();

    if (!context) {
      return;
    }

    if (context.tableNode.childCount <= 1) {
      deleteCurrentTable();
      return;
    }

    replaceTable((tableJson, currentContext) => {
      tableJson.content?.splice(currentContext.rowIndex, 1);
    });
  }

  function deleteTableColumn() {
    replaceTable((tableJson, context) => {
      tableJson.content?.forEach((row) => {
        row.content = row.content ?? [];

        if (row.content.length > 1) {
          row.content.splice(context.cellIndex, 1);
        }
      });
    });
  }

  function deleteCurrentTable() {
    const context = getTableContext();

    if (!context) {
      return;
    }

    const transaction = activeEditor.state.tr.delete(context.tablePos, context.tablePos + context.tableNode.nodeSize);
    activeEditor.view.dispatch(transaction);
    activeEditor.commands.focus();
  }

  function mergeCellRight() {
    replaceTable((tableJson, context) => {
      const row = tableJson.content?.[context.rowIndex];
      const cells = row?.content as Array<{ attrs?: Record<string, unknown>; content?: unknown[] }> | undefined;

      if (!cells || context.cellIndex >= cells.length - 1) {
        return;
      }

      const currentCell = cells[context.cellIndex];
      const nextCell = cells[context.cellIndex + 1];
      const currentColspan = Number(currentCell.attrs?.colspan || 1);
      const nextColspan = Number(nextCell.attrs?.colspan || 1);
      currentCell.attrs = { ...(currentCell.attrs ?? {}), colspan: currentColspan + nextColspan };
      currentCell.content = [...(currentCell.content ?? [{ type: "paragraph" }]), ...(nextCell.content ?? [])];
      cells.splice(context.cellIndex + 1, 1);
    });
  }

  function splitCurrentCell() {
    replaceTable((tableJson, context) => {
      const row = tableJson.content?.[context.rowIndex];
      const cells = row?.content as Array<{ attrs?: Record<string, unknown>; content?: unknown[] }> | undefined;
      const currentCell = cells?.[context.cellIndex];
      const colspan = Number(currentCell?.attrs?.colspan || 1);

      if (!cells || !currentCell || colspan <= 1) {
        return;
      }

      currentCell.attrs = { ...(currentCell.attrs ?? {}), colspan: 1, rowspan: 1 };
      cells.splice(context.cellIndex + 1, 0, ...Array.from({ length: colspan - 1 }, blankTableCellJson));
    });
  }

  function toggleTableWidth() {
    replaceTable((tableJson) => {
      const currentLayout = tableJson.attrs?.layout === "auto" ? "auto" : "fixed";
      tableJson.attrs = { ...(tableJson.attrs ?? {}), layout: currentLayout === "fixed" ? "auto" : "fixed" };
    });
  }

  function deleteSelectedDivider() {
    if (!selectedDivider) {
      return;
    }

    activeEditor.chain().focus().deleteSelection().run();
    setSelectedDivider(false);
  }

  function findReplace() {
    const find = window.prompt(labels.findReplace);

    if (!find) {
      return;
    }

    const replacement = window.prompt(labels.findReplace, "") ?? "";
    activeEditor.commands.setContent(replaceTextInHtml(activeEditor.getHTML(), find, replacement));
  }

  function setImageWidth(width: string) {
    activeEditor.chain().focus().updateAttributes("image", { width }).run();
    setSelectedImage(activeEditor.isActive("image"));
  }

  function setCustomImageWidth() {
    const currentWidth = activeEditor.getAttributes("image").width as string | undefined;
    const width = window.prompt(labels.imageWidthPrompt, currentWidth ?? "70%");

    if (!width) {
      return;
    }

    setImageWidth(width);
  }

  function setImageCaption() {
    const currentCaption = activeEditor.getAttributes("image").caption as string | undefined;
    const caption = window.prompt(labels.imageCaption, currentCaption ?? "");

    if (caption === null) {
      return;
    }

    activeEditor.chain().focus().updateAttributes("image", { caption }).run();
    setSelectedImage(activeEditor.isActive("image"));
  }

  function setImageAlign(align: "left" | "center" | "right") {
    activeEditor.chain().focus().updateAttributes("image", { align }).run();
    setSelectedImage(activeEditor.isActive("image"));
  }

  const isTableActive = selectedTable;

  return (
    <div className={`${isFullScreen ? "fixed inset-0 z-50 overflow-hidden bg-white p-4" : ""}`}>
    <div className={`flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${isFullScreen ? "h-[calc(100vh-2rem)]" : "h-[72vh] min-h-[520px] max-h-[760px]"}`}>
      <div className="rich-editor-toolbar z-10 flex shrink-0 flex-wrap gap-1 border-b border-slate-200 bg-white/95 p-1.5 backdrop-blur">
        <ToolbarGroup>
          <EditorButton active={activeEditor.isActive("paragraph")} onClick={() => activeEditor.chain().focus().setParagraph().run()}>
            {labels.paragraph}
          </EditorButton>
          <EditorButton active={activeEditor.isActive("heading", { level: 1 })} onClick={() => activeEditor.chain().focus().toggleHeading({ level: 1 }).run()}>
            {labels.heading1}
          </EditorButton>
          <EditorButton active={activeEditor.isActive("heading", { level: 2 })} onClick={() => activeEditor.chain().focus().toggleHeading({ level: 2 }).run()}>
            {labels.heading2}
          </EditorButton>
          <EditorButton active={activeEditor.isActive("heading", { level: 3 })} onClick={() => activeEditor.chain().focus().toggleHeading({ level: 3 }).run()}>
            {labels.heading3}
          </EditorButton>
        </ToolbarGroup>
        <ToolbarGroup>
          <EditorButton active={activeEditor.isActive("bold")} onClick={() => activeEditor.chain().focus().toggleBold().run()}>
            {labels.bold}
          </EditorButton>
          <EditorButton active={activeEditor.isActive("italic")} onClick={() => activeEditor.chain().focus().toggleItalic().run()}>
            {labels.italic}
          </EditorButton>
          <EditorButton active={activeEditor.isActive("strike")} onClick={() => activeEditor.chain().focus().toggleStrike().run()}>
            {labels.strike}
          </EditorButton>
          <EditorButton active={activeEditor.isActive("code")} onClick={() => activeEditor.chain().focus().toggleCode().run()}>
            {labels.inlineCode}
          </EditorButton>
          <EditorButton active={false} onClick={() => activeEditor.chain().focus().unsetAllMarks().clearNodes().run()}>
            {labels.clearFormat}
          </EditorButton>
        </ToolbarGroup>
        <ToolbarGroup>
          <EditorColorInput label={labels.textColor} defaultValue="#dc2626" onChange={(value) => setStyleMark({ color: value })} />
          <EditorColorInput label={labels.highlightColor} defaultValue="#fef3c7" onChange={(value) => setStyleMark({ backgroundColor: value })} />
          <EditorSelect
            label={labels.fontSize}
            options={fontSizeOptions}
            onChange={(value) => (value ? setStyleMark({ fontSize: value }) : clearStyleMark())}
          />
          <EditorSelect
            label={labels.fontFamily}
            options={fontFamilyOptions}
            onChange={(value) => (value ? setStyleMark({ fontFamily: value }) : clearStyleMark())}
          />
          <EditorButton active={false} onClick={() => setTextAlign("left")}>
            {labels.alignLeft}
          </EditorButton>
          <EditorButton active={false} onClick={() => setTextAlign("center")}>
            {labels.alignCenter}
          </EditorButton>
          <EditorButton active={false} onClick={() => setTextAlign("right")}>
            {labels.alignRight}
          </EditorButton>
        </ToolbarGroup>
        <ToolbarGroup>
          <EditorButton active={activeEditor.isActive("bulletList")} onClick={() => activeEditor.chain().focus().toggleBulletList().run()}>
            {labels.bulletList}
          </EditorButton>
          <EditorButton active={activeEditor.isActive("orderedList")} onClick={() => activeEditor.chain().focus().toggleOrderedList().run()}>
            {labels.orderedList}
          </EditorButton>
          <EditorButton active={activeEditor.isActive("blockquote")} onClick={() => activeEditor.chain().focus().toggleBlockquote().run()}>
            {labels.quote}
          </EditorButton>
          <EditorButton active={activeEditor.isActive("codeBlock")} onClick={() => activeEditor.chain().focus().toggleCodeBlock().run()}>
            {labels.code}
          </EditorButton>
        </ToolbarGroup>
        <ToolbarGroup>
          <EditorButton active={activeEditor.isActive("link")} onClick={setLink}>
            {labels.link}
          </EditorButton>
          <EditorButton active={false} disabled={!activeEditor.isActive("link")} onClick={() => activeEditor.chain().focus().unsetLink().run()}>
            {labels.unlink}
          </EditorButton>
          <EditorButton active={false} onClick={insertImage}>
            {labels.image}
          </EditorButton>
          <EditorButton active={false} disabled={!onUploadFile || isUploadingImage} onClick={() => fileInputRef.current?.click()}>
            {isUploadingImage ? labels.imageUploading : labels.imageUpload}
          </EditorButton>
          <EditorButton active={false} onClick={() => insertMedia("video", labels.video)}>
            {labels.video}
          </EditorButton>
          <EditorButton active={false} onClick={() => insertMedia("audio", labels.audio)}>
            {labels.audio}
          </EditorButton>
        </ToolbarGroup>
        <ToolbarGroup>
          <EditorButton active={false} disabled={!selectedImage} onClick={() => setImageWidth("45%")}>
            {labels.imageSmall}
          </EditorButton>
          <EditorButton active={false} disabled={!selectedImage} onClick={() => setImageWidth("70%")}>
            {labels.imageMedium}
          </EditorButton>
          <EditorButton active={false} disabled={!selectedImage} onClick={() => setImageWidth("100%")}>
            {labels.imageFull}
          </EditorButton>
          <EditorButton active={false} disabled={!selectedImage} onClick={setCustomImageWidth}>
            {labels.imageCustom}
          </EditorButton>
          <EditorButton active={false} disabled={!selectedImage} onClick={setImageCaption}>
            {labels.imageCaption}
          </EditorButton>
          <EditorButton active={false} disabled={!selectedImage} onClick={() => setImageAlign("left")}>
            {labels.imageAlignLeft}
          </EditorButton>
          <EditorButton active={false} disabled={!selectedImage} onClick={() => setImageAlign("center")}>
            {labels.imageAlignCenter}
          </EditorButton>
          <EditorButton active={false} disabled={!selectedImage} onClick={() => setImageAlign("right")}>
            {labels.imageAlignRight}
          </EditorButton>
        </ToolbarGroup>
        <ToolbarGroup>
          <TablePicker
            label={labels.insertTable}
            open={tablePickerOpen}
            size={tablePickerSize}
            onToggle={() => setTablePickerOpen((value) => !value)}
            onHover={setTablePickerSize}
            onPick={(rows, cols) => insertTable(rows, cols)}
          />
          <EditorButton active={false} disabled={!isTableActive} onClick={addTableRow}>
            {labels.tableAddRow}
          </EditorButton>
          <EditorButton active={false} disabled={!isTableActive} onClick={addTableColumn}>
            {labels.tableAddColumn}
          </EditorButton>
          <EditorButton active={false} disabled={!isTableActive} onClick={mergeCellRight}>
            {labels.tableMergeRight}
          </EditorButton>
          <EditorButton active={false} disabled={!canSplitTableCell} onClick={splitCurrentCell}>
            {labels.tableSplitCell}
          </EditorButton>
          <EditorButton active={false} disabled={!isTableActive} onClick={deleteTableRow}>
            {labels.tableDeleteRow}
          </EditorButton>
          <EditorButton active={false} disabled={!isTableActive} onClick={deleteTableColumn}>
            {labels.tableDeleteColumn}
          </EditorButton>
          <EditorButton active={false} disabled={!isTableActive} onClick={toggleTableWidth}>
            {labels.tableToggleWidth}
          </EditorButton>
          <EditorButton active={false} disabled={!isTableActive} onClick={deleteCurrentTable}>
            {labels.tableDeleteTable}
          </EditorButton>
          <EditorButton active={false} onClick={findReplace}>
            {labels.findReplace}
          </EditorButton>
          <EditorButton active={false} onClick={() => activeEditor.chain().focus().setHorizontalRule().run()}>
            {labels.divider}
          </EditorButton>
          <EditorButton active={selectedDivider} disabled={!selectedDivider} onClick={deleteSelectedDivider}>
            {labels.deleteDivider}
          </EditorButton>
          <EditorButton active={false} onClick={() => activeEditor.chain().focus().setHardBreak().run()}>
            {labels.lineBreak}
          </EditorButton>
          <EditorButton active={false} disabled={!activeEditor.can().undo()} onClick={() => activeEditor.chain().focus().undo().run()}>
            {labels.undo}
          </EditorButton>
          <EditorButton active={false} disabled={!activeEditor.can().redo()} onClick={() => activeEditor.chain().focus().redo().run()}>
            {labels.redo}
          </EditorButton>
          <EditorButton active={isFullScreen} onClick={() => setIsFullScreen((value) => !value)}>
            {isFullScreen ? labels.exitFullScreen : labels.fullScreen}
          </EditorButton>
        </ToolbarGroup>
      </div>
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];

          if (file) {
            void uploadImageFile(file);
          }
        }}
      />
      <div className="rich-editor-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <EditorContent editor={activeEditor} />
      </div>
      <p className="shrink-0 border-t border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
        {labels.autosaved}: {lastAutoSaved || "--:--:--"}
      </p>
    </div>
    </div>
  );
}

function ToolbarGroup({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1 rounded-md bg-slate-50 p-0.5">{children}</div>;
}

function EditorColorInput({
  label,
  defaultValue,
  onChange,
}: {
  label: string;
  defaultValue: string;
  onChange: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <label className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-black leading-none text-slate-700">
      <span>{label}</span>
      <input
        className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
        type="color"
        value={value}
        onChange={(event) => {
          setValue(event.currentTarget.value);
          onChange(event.currentTarget.value);
        }}
      />
    </label>
  );
}

function EditorSelect({
  label,
  options,
  onChange,
}: {
  label: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-black leading-none text-slate-700">
      <span>{label}</span>
      <select
        className="max-w-24 cursor-pointer border-0 bg-transparent text-[10px] font-black text-slate-700 outline-none"
        defaultValue=""
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map((option) => (
          <option key={`${label}-${option.value || "default"}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TablePicker({
  label,
  open,
  size,
  onToggle,
  onHover,
  onPick,
}: {
  label: string;
  open: boolean;
  size: { rows: number; cols: number };
  onToggle: () => void;
  onHover: (size: { rows: number; cols: number }) => void;
  onPick: (rows: number, cols: number) => void;
}) {
  const rows = Array.from({ length: 6 }, (_, index) => index + 1);
  const cols = Array.from({ length: 6 }, (_, index) => index + 1);

  return (
    <div className="relative">
      <EditorButton active={open} onClick={onToggle}>
        {label}
      </EditorButton>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
          <p className="mb-2 text-center text-[11px] font-black text-slate-700">
            {size.rows} x {size.cols}
          </p>
          <div className="grid grid-cols-6 gap-1">
            {rows.flatMap((row) =>
              cols.map((col) => {
                const selected = row <= size.rows && col <= size.cols;

                return (
                  <button
                    key={`${row}-${col}`}
                    className={`h-5 rounded border transition ${
                      selected ? "border-blue-500 bg-blue-100" : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                    type="button"
                    aria-label={`${row} x ${col}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => onHover({ rows: row, cols: col })}
                    onClick={() => onPick(row, col)}
                  />
                );
              }),
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EditorButton({
  active,
  children,
  disabled = false,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-md border px-1.5 py-1 text-[10px] font-black leading-none transition ${
        active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      } disabled:cursor-not-allowed disabled:opacity-40`}
      type="button"
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
