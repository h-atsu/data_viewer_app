import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Typography,
  Box,
  Chip
} from '@mui/material';
import type { TableData } from '../archive/App';
import { queryData } from '../utils/duckdb';

interface DataTableProps {
  data: TableData;
}

const DataTable: React.FC<DataTableProps> = ({ data: initialData }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [orderBy, setOrderBy] = useState<string>('');
  const [orderDirection, setOrderDirection] = useState<'ASC' | 'DESC'>('ASC');
  const [currentData, setCurrentData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  const handleChangePage = async (event: unknown, newPage: number) => {
    setLoading(true);
    try {
      const offset = newPage * rowsPerPage;
      const result = await queryData(offset, rowsPerPage, orderBy, orderDirection);
      setCurrentData({
        ...currentData,
        rows: result.rows
      });
      setPage(newPage);
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRowsPerPage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setLoading(true);
    try {
      const result = await queryData(0, newRowsPerPage, orderBy, orderDirection);
      setCurrentData({
        ...currentData,
        rows: result.rows
      });
      setRowsPerPage(newRowsPerPage);
      setPage(0);
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = async (column: string) => {
    setLoading(true);
    try {
      const newDirection = orderBy === column && orderDirection === 'ASC' ? 'DESC' : 'ASC';
      const offset = page * rowsPerPage;
      const result = await queryData(offset, rowsPerPage, column, newDirection);
      
      setOrderBy(column);
      setOrderDirection(newDirection);
      setCurrentData({
        ...currentData,
        rows: result.rows
      });
    } catch (error) {
      console.error('ソートエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      {/* データ情報 */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        <Typography variant="h6">
          データ表示
        </Typography>
        <Chip 
          label={`総行数: ${currentData.totalRows.toLocaleString()}`} 
          color="primary" 
          variant="outlined" 
        />
        <Chip 
          label={`列数: ${currentData.columns.length}`} 
          color="secondary" 
          variant="outlined" 
        />
      </Box>

      {/* テーブル */}
      <TableContainer sx={{ maxHeight: 600 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {currentData.columns.map((column, index) => (
                <TableCell 
                  key={index}
                  sx={{ 
                    fontWeight: 'bold',
                    backgroundColor: 'grey.100',
                    minWidth: 120
                  }}
                >
                  <TableSortLabel
                    active={orderBy === column}
                    direction={orderBy === column ? orderDirection.toLowerCase() as 'asc' | 'desc' : 'asc'}
                    onClick={() => handleSort(column)}
                    disabled={loading}
                  >
                    {column}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {currentData.rows.map((row, rowIndex) => (
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
                <TableCell colSpan={currentData.columns.length} align="center">
                  読み込み中...
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ページネーション */}
      <TablePagination
        component="div"
        count={currentData.totalRows}
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
    </Box>
  );
};

export default DataTable; 