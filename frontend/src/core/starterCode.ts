import type { Language } from '../types'

export const starterCode: Record<Language, string> = {
  python: 
    `# Python
    print("Hello, World!")`,
  java: 
    `// Java — public class must be named Main
    public class Main {
        public static void main(String[] args) {
            System.out.println("Hello, World!");
        }
    }
}`,
  c: 
    `// C
    #include <stdio.h>

    int main() {
        printf("Hello, World!\\n");
        return 0;
    }
}`,
  shell: 
    `#!/bin/sh
        echo "Hello, World!" `,
  lisp: 
    `; Common Lisp
    (format t "Hello, World!~%") `,
  prolog: 
    `% Prolog
    :- initialization(main, main).
    main :- write('Hello, World!'), nl. `,

}