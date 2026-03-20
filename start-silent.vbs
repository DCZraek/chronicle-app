Dim shell
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\Users\dzrik\chronicle-app"
shell.Run "node tray.js", 0, False
Set shell = Nothing