import { S3StreamSessionDetails } from "upaki-cli";
import { UploadState } from "../sync/task/UploaderTask";

export interface CredentialDevice {
    device_id: string;
    credential_key: string;
    token: string;
    user_id: string;
}

export interface FolderObject {
    key: string;
    id: string;
}

export interface EntityUploadData {
    key: string;
    lastModifies: string;
    file_id: string;
    folder_id: string;
    sessionData?: S3StreamSessionDetails;
    state: UploadState;
    Etag: string;
    path: string;
}