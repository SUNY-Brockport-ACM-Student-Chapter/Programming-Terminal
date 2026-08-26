import type { EditorFile, Language } from '../types'

// Returns default starter file for a language
export function getStarterFiles(language: Language): EditorFile[]{
  switch(language){
    case 'c':
      return[{
        id: crypto.randomUUID(),
        filename: 'main.c',
        content:
        `// C
        \n#include <stdio.h>
        \nint main(){
        \n  printf("Hello, World!\\n");
        \n  return 0;
        \n}
        \n`,
      }]

    case 'java':
      return[{
        id: crypto.randomUUID(),
        filename: 'Main.java',
        content:
        `// Java
        \npublic class Main {
        \n  public static void main(String[] args){
              \n    System.out.println("Hello, World!\\n");
            \n  }
        \n}
        \n`,
      }]

    case 'lisp':
      return[{
        id: crypto.randomUUID(),
        filename: 'main.lisp',
        content:
        `; Common Lisp
        \n(format t "Hello, World! ~%")
        \n`,
      }]
    
    case 'prolog':
      return[{
        id: crypto.randomUUID(),
        filename: 'main.pl',
        content:
        `% Prolog
        \n:- initialization(main).
        \nmain :- write(\'Hello, World!\'), nl.
        \n`,
      }]

    case 'python':
      return[{
        id: crypto.randomUUID(),
        filename: 'main.py',
        content:
        `#Python
        \nprint("Hello, World!")
        \n`,
      }]

    case 'shell':
      return[{
        id: crypto.randomUUID(),
        filename: 'main.sh',
        content:
        `#!/bin/sh
        \necho "Hello, World!"
        \n`,
      }]
  }
}

// Validates that a filename only contains safe characters
function isSafeFilename(filename:string) : boolean {
  return /^[A-Za-z0-9_\-\.]+$/.test(filename) && !filename.startsWith('.')
}

// Returns blank file template for the given language and filename. Used when a user adds a new tab
export function newFileTemplate(language:Language, filename: string): EditorFile{
  const safeFilename = isSafeFilename(filename) ? filename : `newfile${Date.now()}`
  const className = safeFilename.replace(/\.\w+$/,'') // strip extension

  const content: Record<Language, string> = {
    c: `// ${safeFilename} \n#include <stdio.h>\n\n`,
    java: `public class ${className} {\n  \n}\n`,
    lisp: `; ${safeFilename}\n`,
    prolog: `% ${safeFilename}\n`,
    python: `# ${safeFilename}\n`,
    shell: `#!/bin/sh\n# ${safeFilename}\n`,
  }

  return{
    id: crypto.randomUUID(),
    filename: safeFilename,
    content: content[language],
  }
}