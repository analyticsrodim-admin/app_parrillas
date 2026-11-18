// netlify/functions/seatable-proxy.js

exports.handler = async (event, context) => {
  // 1. Verificación de seguridad de Netlify Identity
  const { user } = context.clientContext;
  if (!user) {
    return { 
      statusCode: 401, 
      body: JSON.stringify({ success: false, message: 'No autorizado. Inicie sesión.' }) 
    };
  }

  // 2. Configuración
  const SEATABLE_API_TOKEN = process.env.SEATABLE_API_TOKEN; 
  const SEATABLE_SERVER = 'https://cloud.seatable.io';
  
  try {
    if (!SEATABLE_API_TOKEN) {
      throw new Error("La variable de entorno SEATABLE_API_TOKEN no está configurada en Netlify.");
    }

    // 3. Obtener el Token de la Base (Base-Token) usando el API-Token
    const authResponse = await fetch(`${SEATABLE_SERVER}/api/v2.1/dtable/app-access-token/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SEATABLE_API_TOKEN}`, // Usar Bearer
        'Accept': 'application/json',
      },
    });

    // Diagnóstico si falla la autenticación
    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      throw new Error(`Error al obtener token (${authResponse.status}): ${errorText}`);
    }
    
    const authData = await authResponse.json();
    const baseToken = authData.access_token; // Token temporal para consultar
    const baseUuid = authData.dtable_uuid;

    // 4. Realizar la consulta SQL a través del API Gateway
    const body = JSON.parse(event.body);
    const idToSearch = body.idToSearch; // ej. "LEG_3152"

    // Construimos la consulta SQL usando comillas invertidas para columnas con espacios o tildes
    const sqlQuery = `SELECT \`CdgUnico\`, \`Médico\`, \`Parilla\`, \`Cdg CUP\` FROM \`parrillas_sugeridas\` WHERE \`CdgUnico\` = '${idToSearch}' LIMIT 1`;

    const queryResponse = await fetch(`${SEATABLE_SERVER}/api-gateway/api/v2/dtables/${baseUuid}/sql/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${baseToken}`, // Usar el token temporal, NO el API_TOKEN
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: sqlQuery }),
    });

    // Diagnóstico si falla la consulta SQL
    if (!queryResponse.ok) {
      const errorText = await queryResponse.text();
      throw new Error(`Error en la consulta SQL (${queryResponse.status}): ${errorText}`);
    }

    const queryData = await queryResponse.json();
    
    // 5. Devolver los resultados al frontend
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, data: queryData.results || [] }),
    };

  } catch (error) {
    console.error('Error capturado en la función:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, message: error.message }),
    };
  }
};
