"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

export type RichEditorApi = {
  getHTML: () => string;
  clear: () => void;
  toggleBold: () => void;
  toggleItalic: () => void;
};

export default function RichCommentEditor({
  placeholder,
  valueKey,
  onReady,
}: {
  placeholder: string;
  valueKey: string;
  onReady: (api: RichEditorApi) => void;
}) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Placeholder.configure({
          placeholder,
        }),
      ],
      immediatelyRender: false,
    },
    [valueKey, placeholder]
  );

  useEffect(() => {
    if (!editor) return;

    onReady({
      getHTML: () => editor.getHTML(),
      clear: () => editor.commands.clearContent(),
      toggleBold: () => editor.chain().focus().toggleBold().run(),
      toggleItalic: () => editor.chain().focus().toggleItalic().run(),
    });
  }, [editor, onReady]);

  return <EditorContent editor={editor} />;
}