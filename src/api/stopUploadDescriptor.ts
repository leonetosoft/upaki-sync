export enum STOP_UPLOAD_DESCRIPTOR {
    FILE_UNLINK = 'File Unlink',
    FILE_CHANGE = 'File Change',
    FILE_NOT_FOUND_MULTIPART_READY = 'The file not found on ready',
    FILE_NOT_FOUND_MULTIPART_RETRY = 'The file not found in retry',
    FILE_NOT_FOUND_MULTIPART_UPLOAD_PART = 'The file removed on upload part',
    FILE_RENAME = 'File renamed'
}