import * as duckdb from '@duckdb/duckdb-wasm';
import type { TableData } from '../archive/App';

let db: duckdb.AsyncDuckDB | null = null;

export const loadDuckDB = async (): Promise<duckdb.AsyncDuckDB> => {
  if (db) return db;

  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  
  // DuckDB WASMバンドルを選択
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
  
  // Worker を初期化
  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  
  // DuckDB を初期化
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  
  return db;
};

export const readFile = async (file: File): Promise<TableData> => {
  const db = await loadDuckDB();
  const conn = await db.connect();
  
  try {
    // ファイルを登録
    await db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
    
    // ファイル形式に応じてテーブルを作成
    const extension = file.name.toLowerCase().split('.').pop();
    let createTableQuery: string;
    
    if (extension === 'csv') {
      createTableQuery = `CREATE TABLE data AS SELECT * FROM read_csv_auto('${file.name}')`;
    } else if (extension === 'parquet') {
      createTableQuery = `CREATE TABLE data AS SELECT * FROM read_parquet('${file.name}')`;
    } else {
      throw new Error('サポートされていないファイル形式です');
    }
    
    await conn.query(createTableQuery);
    
    // カラム情報を取得
    const columnsResult = await conn.query("PRAGMA table_info('data')");
    const columns = columnsResult.toArray().map((row: any) => row.name);
    
    // 総行数を取得
    const countResult = await conn.query('SELECT COUNT(*) as count FROM data');
    const totalRows = countResult.toArray()[0].count;
    
    // 最初の100行を取得
    const dataResult = await conn.query('SELECT * FROM data LIMIT 100');
    const rows = dataResult.toArray().map((row: any) => 
      columns.map(col => row[col])
    );
    
    return {
      columns,
      rows,
      totalRows: Number(totalRows)
    };
    
  } finally {
    await conn.close();
  }
};

export const queryData = async (
  offset: number = 0, 
  limit: number = 100,
  orderBy?: string,
  orderDirection: 'ASC' | 'DESC' = 'ASC'
): Promise<{ rows: any[][], totalRows: number }> => {
  if (!db) throw new Error('DuckDB is not initialized');
  
  const conn = await db.connect();
  
  try {
    // 総行数を取得
    const countResult = await conn.query('SELECT COUNT(*) as count FROM data');
    const totalRows = Number(countResult.toArray()[0].count);
    
    // データを取得
    let query = 'SELECT * FROM data';
    
    if (orderBy) {
      query += ` ORDER BY "${orderBy}" ${orderDirection}`;
    }
    
    query += ` LIMIT ${limit} OFFSET ${offset}`;
    
    const dataResult = await conn.query(query);
    const dataArray = dataResult.toArray();
    
    // カラム情報を取得
    const columnsResult = await conn.query("PRAGMA table_info('data')");
    const columns = columnsResult.toArray().map((row: any) => row.name);
    
    const rows = dataArray.map((row: any) => 
      columns.map(col => row[col])
    );
    
    return { rows, totalRows };
    
  } finally {
    await conn.close();
  }
}; 