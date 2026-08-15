; 卸载时删除用户配置数据目录（Electron userData，即 %APPDATA%\league-skins）
; 目录名与 package.json 的 name 一致，对应 src/main/constants.ts 的 app.getPath('userData')
!macro customUnInstall
  RMDir /r "$APPDATA\league-skins"
!macroend
