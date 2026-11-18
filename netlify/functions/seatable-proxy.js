// netlify/functions/seatable-proxy.js

exports.handler = async (event, context) => {
  // 1. VERIFICACIÓN DE SEGURIDAD (Netlify Identity)
  const { user } = context.clientContext;
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ message: 'No autorizado. Inicie sesión.' }) };
  }

  // 2. CONFIGURACIÓN DE SEATABLE
  const SEATABLE_API_TOKEN = process.env.SEATABLE_API_TOKEN; 
  const SEATABLE_SERVER = 'https://cloud.seatable.io'; 
  
  try {
    // 3. OBTENER TOKEN TEMPORAL DE LA BASE
    const authResponse = await fetch(`${SEATABLE_SERVER}/api/v2.1/dtable/app-access-token/`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${SEATABLE_API_TOKEN}`,
        'Accept': 'application/json; charset=utf-8; indent=4',
      },
    });

    if (!authResponse.ok) throw new Error('Error de autenticación con SeaTable');
    
    const authData = await authResponse.json();
    const baseToken = authData.access_token;
    const baseUuid = authData.dtable_uuid;

    // 4. REALIZAR LA CONSULTA
    const body = JSON.parse(event.body);
    const idToSearch = body.idToSearch; 

    // Consulta SQL apuntando a la tabla y columnas exactas solicitadas
    // Usamos las comillas invertidas (`) para columnas con espacios como "Cdg CUP"
    const sqlQuery = `SELECT \`CdgUnico\`, \`Médico\`, \`Parilla\`, \`Cdg CUP\` FROM \`parrillas_sugeridas\` WHERE \`CdgUnico\` = '${idToSearch}' LIMIT 1`;

    const queryResponse = await fetch(`${SEATABLE_SERVER}/dtable-db/api/v1/query/${baseUuid}/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${baseToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: sqlQuery,
        convert_keys: true, 
      }),
    });

    if (!queryResponse.ok) throw new Error('Error en la consulta a SeaTable');

    const queryData = await queryResponse.json();
    
    // 5. DEVOLVER RESULTADOS
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, data: queryData.results || [] }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: error.message }),
    };
  }
};
