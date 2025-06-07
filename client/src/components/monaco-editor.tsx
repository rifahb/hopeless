import { useEffect, useRef, useState } from "react";

interface MonacoEditorProps {
  value: string;
  language: string;
  onChange: (value: string) => void;
  options?: object;
}

export default function MonacoEditor({ value, language, onChange, options = {} }: MonacoEditorProps) {
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  
  useEffect(() => {
    // Load Monaco editor
    if (!containerRef.current) return;
    
    const loadMonaco = async () => {
      try {
        // Disable web workers entirely to avoid the errors
        window.MonacoEnvironment = {
          getWorker: function(): any {
            return null as any;
          }
        };
        
        // Import monaco with minimal features to avoid worker dependencies
        const monaco = await import('monaco-editor/esm/vs/editor/editor.api');
        
        // Create a basic editor with minimal features
        if (containerRef.current && !editorRef.current) {
          const editor = monaco.editor.create(containerRef.current, {
            value,
            language,
            theme: 'vs',
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 14,
            // Disable features that require workers
            quickSuggestions: false,
            suggestOnTriggerCharacters: false,
            foldingStrategy: "indentation" as any,
            formatOnType: false,
            formatOnPaste: false,
            parameterHints: { enabled: false },
            accessibilitySupport: 'off',
            wordBasedSuggestions: "off" as any,
            acceptSuggestionOnEnter: "off",
            occurrencesHighlight: "off" as any,
            suggest: { showWords: false },
            ...options
          });
          
          editorRef.current = editor;
          
          // Set up change event handler
          editor.onDidChangeModelContent(() => {
            const newValue = editor.getValue();
            if (newValue !== value) {
              onChange(newValue);
            }
          });
          
          // Disable copy-paste functionality
          const editorTextArea = containerRef.current.querySelector('textarea');
          if (editorTextArea) {
            editorTextArea.addEventListener('copy', e => {
              e.preventDefault();
              alert('Copying is disabled for this assignment.');
            });
            
            editorTextArea.addEventListener('paste', e => {
              e.preventDefault();
              alert('Pasting is disabled for this assignment.');
            });
          }
          
          setIsEditorReady(true);
        }
      } catch (err) {
        console.error("Failed to load Monaco editor:", err);
        // Fallback to a simple textarea if Monaco fails to load
        if (containerRef.current) {
          const textArea = document.createElement('textarea');
          textArea.value = value;
          textArea.style.width = '100%';
          textArea.style.height = '100%';
          textArea.style.fontFamily = 'monospace';
          textArea.style.fontSize = '14px';
          textArea.addEventListener('input', (e) => {
            onChange((e.target as HTMLTextAreaElement).value);
          });
          textArea.addEventListener('copy', e => {
            e.preventDefault();
            alert('Copying is disabled for this assignment.');
          });
          textArea.addEventListener('paste', e => {
            e.preventDefault();
            alert('Pasting is disabled for this assignment.');
          });
          
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(textArea);
        }
      }
    };
    
    loadMonaco();
    
    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, []);
  
  // Update editor value when prop changes
  useEffect(() => {
    if (isEditorReady && editorRef.current && value !== editorRef.current.getValue()) {
      editorRef.current.setValue(value);
    }
  }, [value, isEditorReady]);
  
  // Update language when it changes
  useEffect(() => {
    if (isEditorReady && editorRef.current) {
      try {
        const model = editorRef.current.getModel();
        if (model) {
          const monaco = (window as any).monaco;
          if (monaco) {
            monaco.editor.setModelLanguage(model, language);
          }
        }
      } catch (err) {
        console.error("Failed to change language:", err);
      }
    }
  }, [language, isEditorReady]);
  
  return <div ref={containerRef} className="h-full" />;
}
