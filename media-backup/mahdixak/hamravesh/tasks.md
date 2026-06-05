# frontend
- [x] when a user have some notes and directories the front application would not fetch them when user open the app

- [ ] find out what are the good things of the obsidian
- [x] implementation of the persian writing right to left
- [x] implementation of moving files to another directories and bring them out
- [x] implementation of the files and directories selection right click menu
- [x] implementation of user settings and what things that most be in the application
- [x] front end code refactoring 
- [ ] adding vairmatn font for persian text 
- [x] implementation of collapse button for sidebar menu
- [x] implementation of settings icon button 

- project structure: 

- - src/hooks/
- - src/components/ — All presentational / screen pieces, grouped lightly
- - components/vault/ — VaultSidebar, VaultNavbar, and their CSS.
- - components/editor/ — MarkdownEditor, EditorEmptyState.
components/modals/ (or components/ui/) — SettingsModal, DeleteConfirmModal, QuickOpenDialog, shared VaultModal.css if it stays shared.
- - src/lib/ or src/api/ — vaultApi.js, auth.js, anything that talks to the network or browser storage and is not React.
- - src/vault/ (or src/domain/vault/) — vaultReducer.js, vaultTreeOps.js, vaultTreePaths.js — pure vault state + tree logic, no JSX.
- - src/app/ — App.jsx, App.css, and optionally main.jsx if you want the entry next to the shell (some teams keep main.jsx at src/ root on purpose; both are fine).
- - Styles — Colocate Foo.css next to Foo.jsx inside the same folder (what you mostly do already); only lift shared tokens to something like src/styles/theme.css if you want one place for variables.


# backend
- [ ] finding out how the files are saving when user is editing files
- [ ] find out the backend core implementation architecture
- [ ] implementation of adding database to the application
- [ ] reading about the SCRF in django


# command-line-interface
this is going to be surprise of this application
its most be implemented after the version 1 of the frontend and backend has been released