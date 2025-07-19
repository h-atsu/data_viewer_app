import React, { useState, useRef } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  LinearProgress,
  Chip
} from '@mui/material';
import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';
import * as duckdb from '@duckdb/duckdb-wasm';
// Viteの?workerと?urlパラメータを使用してCORSエラーを回避
import duckdb_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?worker';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
  },
});

interface TableData {
  columns: string[];
  rows: any[][];
  totalRows: number;
}

function App() {
  const [status, setStatus] = useState<string>('ファイルを選択してください');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [db, setDb] = useState<duckdb.AsyncDuckDB | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // DuckDBを初期化（参考リポジトリの方式）
  const initDuckDB = async (): Promise<duckdb.AsyncDuckDB> => {
    if (db) return db;

    const worker = new duckdb_worker();
    const logger = new duckdb.ConsoleLogger();
    const newDb = new duckdb.AsyncDuckDB(logger, worker);
    await newDb.instantiate(duckdb_wasm);
    
    setDb(newDb);
    return newDb;
  };

  const readFile = async (file: File): Promise<TableData> => {
    const database = await initDuckDB();
    const conn = await database.connect();
    
    try {
      // ファイルを登録
      await database.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
      
      // テーブルを作成
      const extension = file.name.toLowerCase().split('.').pop();
      let createQuery = '';
      
      if (extension === 'csv') {
        createQuery = `CREATE TABLE main_table AS SELECT * FROM read_csv_auto('${file.name}')`;
      } else if (extension === 'parquet') {
        createQuery = `CREATE TABLE main_table AS SELECT * FROM read_parquet('${file.name}')`;
      } else {
        throw new Error('CSVまたはParquetファイルを選択してください');
      }
      
      await conn.query(createQuery);
      
      // カラム情報を取得
      const columnsResult = await conn.query("PRAGMA table_info('main_table')");
      const columns = columnsResult.toArray().map((row: any) => row.name);
      
      // 総行数を取得
      const countResult = await conn.query('SELECT COUNT(*) as count FROM main_table');
      const totalRows = Number(countResult.toArray()[0].count);
      
      // 最初のページのデータを取得
      const dataResult = await conn.query(`SELECT * FROM main_table LIMIT ${rowsPerPage}`);
      const rows = dataResult.toArray().map((row: any) => 
        columns.map(col => row[col])
      );
      
      return {
        columns,
        rows,
        totalRows
      };
      
    } finally {
      await conn.close();
    }
  };

  const loadPage = async (newPage: number, newRowsPerPage?: number) => {
    if (!data || !db) return;
    
    setLoading(true);
    try {
      const conn = await db.connect();
      
      const limit = newRowsPerPage || rowsPerPage;
      const offset = newPage * limit;
      
      const dataResult = await conn.query(
        `SELECT * FROM main_table LIMIT ${limit} OFFSET ${offset}`
      );
      
      const rows = dataResult.toArray().map((row: any) => 
        data.columns.map(col => row[col])
      );
      
      setData({ ...data, rows });
      setPage(newPage);
      if (newRowsPerPage) setRowsPerPage(newRowsPerPage);
      
      await conn.close();
    } catch (error) {
      console.error('ページ読み込みエラー:', error);
      setError(`ページ読み込みエラー: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.toLowerCase().split('.').pop();
    if (!['csv', 'parquet'].includes(extension || '')) {
      setError('CSVまたはParquetファイルを選択してください');
      return;
    }

    setLoading(true);
    setStatus('ファイルを読み込み中...');
    setError(null);
    setData(null);
    setPage(0);
    
    try {
      const result = await readFile(file);
      setData(result);
      setStatus(`ファイル読み込み完了！`);
    } catch (err) {
      console.error('ファイル読み込みエラー:', err);
      setError(`ファイル読み込みエラー: ${err instanceof Error ? err.message : String(err)}`);
      setStatus('エラー発生');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    loadPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    loadPage(0, newRowsPerPage);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center">
          Data Viewer App
        </Typography>
        <Typography variant="subtitle1" align="center" color="text.secondary" sx={{ mb: 4 }}>
          CSV・Parquetファイルを読み込んでテーブル表示
        </Typography>
        
        {/* ファイルアップロード */}
        <Paper sx={{ p: 3, mb: 3, textAlign: 'center' }}>
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
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            startIcon={<CloudUploadIcon />}
            size="large"
          >
            ファイルを選択
          </Button>
          
          {loading && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {status}
              </Typography>
              <LinearProgress />
            </Box>
          )}
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            {error}
          </Alert>
        )}

        {/* データテーブル */}
        {data && (
          <Paper sx={{ p: 2 }}>
            <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="h6">
                データ表示
              </Typography>
              <Chip 
                label={`総行数: ${data.totalRows.toLocaleString()}`} 
                color="primary" 
                variant="outlined" 
              />
              <Chip 
                label={`列数: ${data.columns.length}`} 
                color="secondary" 
                variant="outlined" 
              />
            </Box>
            
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {data.columns.map((column, index) => (
                      <TableCell 
                        key={index}
                        sx={{ 
                          fontWeight: 'bold',
                          backgroundColor: 'grey.100',
                          minWidth: 120
                        }}
                      >
                        {column}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.rows.map((row, rowIndex) => (
                    <TableRow 
                      key={rowIndex}
                      hover
                      sx={{ '&:nth-of-type(odd)': { backgroundColor: 'action.hover' } }}
                    >
                      {row.map((cell, cellIndex) => (
                        <TableCell 
                          key={cellIndex}
                          sx={{ 
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {cell !== null ? String(cell) : ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={data.columns.length} align="center">
                        読み込み中...
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={data.totalRows}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[25, 50, 100, 200]}
              labelRowsPerPage="1ページあたりの行数:"
              labelDisplayedRows={({ from, to, count }) =>
                `${from}-${to} / ${count !== -1 ? count : `${to}以上`}`
              }
              disabled={loading}
            />
          </Paper>
        )}
      </Container>
    </ThemeProvider>
  );
}

export default App; 