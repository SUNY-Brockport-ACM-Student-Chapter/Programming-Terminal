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
        \n\nint main() {
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
        \npublic class Main{
        \n  public static void main(String[] args){
              \nSystem.out.println("Hello, World!\\n");
              \n
            \n}
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

// Returns blank file template for the given language and filename. Used when a user adds a new tab
export function newFileTemplate(language:Language, filename: string): EditorFile{
  const className = filename.replace(/\.\w+$/,'') // strip extension

  const content: Record<Language, string> = {
    c: `// ${filename} \n#include <stdio.h>\n\n`,
    java: `public class ${className} {\n  \n}\n`,
    lisp: `; ${filename}\n`,
    prolog: `% ${filename}\n`,
    python: `# ${filename}\n`,
    shell: `#!/bin/sh\n# ${filename}\n`,
  }

  return{
    id: crypto.randomUUID(),
    filename,
    content: content[language],
  }
}