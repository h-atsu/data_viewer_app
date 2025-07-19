import React, { useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  Paper
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon
} from '@mui/icons-material';
import { readFile } from '@/utils/duckdb';
import type { TableData } from '@/types';

interface FileUploaderProps {
  onFileLoad: (data: TableData) => void;
  onError: (error: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  onFileLoad,
  onError,
  loading,
  setLoading
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // ファイル形式をチェック
    const extension = file.name.toLowerCase().split('.').pop();
    if (!['csv', 'parquet'].includes(extension || '')) {
      onError('CSVまたはParquetファイルを選択してください');
      return;
    }

    setLoading(true);
    try {
      const data = await readFile(file);
      onFileLoad(data);
    } catch (error) {
      onError(`ファイルの読み込みエラー: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Paper sx={{ p: 3, textAlign: 'center' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.parquet"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      
      <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
      
      <Typography variant="h6" gutterBottom>
        ファイルをアップロード
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        CSV または Parquet ファイルを選択してください
      </Typography>
      
      <Button
        variant="contained"
        onClick={handleButtonClick}
        disabled={loading}
        startIcon={<CloudUploadIcon />}
        size="large"
      >
        ファイルを選択
      </Button>
      
      {loading && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            ファイルを読み込み中...
          </Typography>
          <LinearProgress />
        </Box>
      )}
    </Paper>
  );
};

export default FileUploader; 