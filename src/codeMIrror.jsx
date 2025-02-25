// src/components/CodeEditor.js
import React, { useState } from "react";
import Editor from "@monaco-editor/react";

const CodeEditor = () => {
  const [code, setCode] = useState("// Start typing 'karan' to see suggestions!");
  const [language, setLanguage] = useState("javascript");

  const languages = ["javascript", "python", "typescript", "java", "html", "css"];

  // Function to handle code changes
  const handleEditorChange = (value) => {
    setCode(value);
  };

  // Function to handle language changes
  const handleLanguageChange = (e) => {
    setLanguage(e.target.value);
    setCode(`// You are now coding in ${e.target.value}!`);
  };

  // Register custom autocomplete when the editor is mounted
  const handleEditorDidMount = (editor, monaco) => {
    monaco.languages.registerCompletionItemProvider("javascript", {
      provideCompletionItems: () => {
        return {
          suggestions: [
            {
              label: "karanFunction",
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: "karanFunction()",
              documentation: "A custom function named karanFunction."
            },
            {
              label: "karanVariable",
              kind: monaco.languages.CompletionItemKind.Variable,
              insertText: "let karanVariable = 100;",
              documentation: "A custom variable named karanVariable."
            }
          ]
        };
      }
    });
  };

  return (
    <div className="h-screen p-4 bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Monaco Editor with Working Autocomplete</h1>

      {/* Language Dropdown */}
      <div className="mb-4">
        <label className="mr-2 font-semibold">Select Language:</label>
        <select
          value={language}
          onChange={handleLanguageChange}
          className="p-2 rounded border border-gray-300"
        >
          {languages.map((lang) => (
            <option key={lang} value={lang}>
              {lang.charAt(0).toUpperCase() + lang.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Monaco Code Editor with onMount for custom autocomplete */}
      <Editor
        height="80vh"
        language={language}
        value={code}
        theme="vs-dark"
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
      />
    </div>
  );
};

export default CodeEditor;
