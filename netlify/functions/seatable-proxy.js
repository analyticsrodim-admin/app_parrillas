// netlify/functions/seatable-proxy.js

exports.handler = async (event, context) => {
  const { user } = context.clientContext;
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ success: false, message: 'No autorizado.' }) };
  }

  const SEATABLE_API_TOKEN = process.env.SEATABLE_API_TOKEN; 
  const SEATABLE_SERVER = 'https://cloud.seatable.io'; // Sin /api-gateway al final
  
  try {
    if (!SEATABLE_API_TOKEN) throw new Error("La variable SEATABLE_API_TOKEN no está configurada.");

    // 1. Obtener Token de la Base (Ruta correcta SIN /api-gateway)
    const authResponse = await fetch(`${SEATABLE_SERVER}/api/v2.1/dtable/app-access-token/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SEATABLE_API_TOKEN}`,
        'Accept': 'application/json',
      },
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      throw new Error(`Error al obtener token (${authResponse.status}): ${errorText}`);
    }
    
    const authData = await authResponse.json();
    const baseToken = authData.access_token;
    const baseUuid = authData.dtable_uuid;

    // 2. Realizar la consulta SQL (Ruta CON /api-gateway)
    const body = JSON.parse(event.body);
    const idToSearch = body.idToSearch; 

    const sqlQuery = `SELECT \`CdgUnico\`, \`Médico\`, \`Parilla\`, \`Cdg CUP\` FROM \`parrillas_sugeridas\` WHERE \`CdgUnico\` = '${idToSearch}' LIMIT 1`;

    const queryResponse = await fetch(`${SEATABLE_SERVER}/api-gateway/api/v2/dtables/${baseUuid}/sql/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${baseToken}`, // Usamos el token de la base
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: sqlQuery }),
    });

    if (!queryResponse.ok) {
      const errorText = await queryResponse.text();
      throw new Error(`Error en la consulta SQL (${queryResponse.status}): ${errorText}`);
    }

    const queryData = await queryResponse.json();
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, data: queryData.results || [] }),
    };

  } catch (error) {
    console.error('Error capturado:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, message: error.message }),
    };
  }
};
