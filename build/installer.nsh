!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "Quitter l'installation de Liquid Dynamic Island ?"

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Installer Liquid Dynamic Island"
  !define MUI_WELCOMEPAGE_TEXT "Bienvenue dans l'assistant d'installation de Liquid Dynamic Island.$\r$\n$\r$\nCette installation prépare l'Island, le raccourci Windows et les composants natifs nécessaires aux contrôles système.$\r$\n$\r$\nClique sur Suivant pour continuer."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customFinishPage
  Function StartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  !define MUI_FINISHPAGE_TITLE "Liquid Dynamic Island est prêt"
  !define MUI_FINISHPAGE_TEXT "L'installation est terminée. Tu peux lancer l'application maintenant et retrouver l'icône dans la zone Windows près de l'horloge."
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_TEXT "Lancer Liquid Dynamic Island"
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !define MUI_FINISHPAGE_LINK "Voir le projet sur GitHub"
  !define MUI_FINISHPAGE_LINK_LOCATION "https://github.com/NALYD2400/dynamique-island"
  !insertmacro MUI_PAGE_FINISH
!macroend

!macro customUnWelcomePage
  !define MUI_UNWELCOMEPAGE_TITLE "Désinstaller Liquid Dynamic Island"
  !define MUI_UNWELCOMEPAGE_TEXT "Cet assistant va retirer Liquid Dynamic Island de ton PC.$\r$\n$\r$\nLes fichiers installés seront supprimés. Tu peux continuer si tu veux enlever l'application."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend
