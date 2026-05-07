import { ipcMain, dialog } from 'electron';

export function registerDialogIpc(): void {
  ipcMain.handle('dialog:pickImage', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Choose an image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0]!;
  });

  ipcMain.handle('dialog:pickImages', async (): Promise<string[]> => {
    const result = await dialog.showOpenDialog({
      title: 'Choose images',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }],
    });
    if (result.canceled) return [];
    return result.filePaths;
  });
}
