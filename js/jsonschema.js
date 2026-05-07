'use strict';
// ══════════════════════════════════════════════════════
//  JSON SCHEMA VALIDATOR (improved)
// ══════════════════════════════════════════════════════
(function() {
  const EXAMPLE_JSON   = '{\n  "name": "João",\n  "age": 30,\n  "email": "joao@exemplo.com"\n}';
  const EXAMPLE_SCHEMA = '{\n  "type": "object",\n  "required": ["name", "age"],\n  "properties": {\n    "name":  { "type": "string",  "minLength": 1 },\n    "age":   { "type": "number",  "minimum": 0, "maximum": 150 },\n    "email": { "type": "string" }\n  },\n  "additionalProperties": false\n}';

  function validate(data, schema, path='root') {
    const errors = [];

    if (schema.type) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      const actual = data===null ? 'null' : Array.isArray(data) ? 'array' : typeof data;
      if (!types.includes(actual)) {
        errors.push(`[${path}] tipo esperado: ${types.join('|')}, recebido: ${actual}`);
        return errors;
      }
    }

    if (typeof data === 'string') {
      if (schema.minLength && data.length < schema.minLength)
        errors.push(`[${path}] string muito curta (mín: ${schema.minLength})`);
      if (schema.maxLength && data.length > schema.maxLength)
        errors.push(`[${path}] string muito longa (máx: ${schema.maxLength})`);
      if (schema.pattern && !new RegExp(schema.pattern).test(data))
        errors.push(`[${path}] não corresponde ao padrão: ${schema.pattern}`);
      if (schema.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data))
        errors.push(`[${path}] formato de email inválido`);
    }

    if (typeof data === 'number') {
      if (schema.minimum !== undefined && data < schema.minimum) errors.push(`[${path}] valor abaixo do mínimo (${schema.minimum})`);
      if (schema.maximum !== undefined && data > schema.maximum) errors.push(`[${path}] valor acima do máximo (${schema.maximum})`);
      if (schema.multipleOf && data % schema.multipleOf !== 0) errors.push(`[${path}] não é múltiplo de ${schema.multipleOf}`);
    }

    if (Array.isArray(data)) {
      if (schema.minItems !== undefined && data.length < schema.minItems) errors.push(`[${path}] array muito curto (mín: ${schema.minItems})`);
      if (schema.maxItems !== undefined && data.length > schema.maxItems) errors.push(`[${path}] array muito longo (máx: ${schema.maxItems})`);
      if (schema.items) data.forEach((item,i) => errors.push(...validate(item, schema.items, `${path}[${i}]`)));
    }

    if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
      const required = schema.required || [];
      required.forEach(k => { if (!(k in data)) errors.push(`[${path}] propriedade obrigatória ausente: "${k}"`); });

      if (schema.properties) {
        Object.entries(schema.properties).forEach(([k, subSchema]) => {
          if (k in data) errors.push(...validate(data[k], subSchema, `${path}.${k}`));
        });
      }

      if (schema.additionalProperties === false && schema.properties) {
        const allowed = new Set(Object.keys(schema.properties));
        Object.keys(data).forEach(k => {
          if (!allowed.has(k)) errors.push(`[${path}] propriedade adicional não permitida: "${k}"`);
        });
      }
    }

    if (schema.enum !== undefined && !schema.enum.some(v => JSON.stringify(v)===JSON.stringify(data)))
      errors.push(`[${path}] valor não está no enum: [${schema.enum.map(v=>JSON.stringify(v)).join(', ')}]`);

    if (schema.const !== undefined && JSON.stringify(data) !== JSON.stringify(schema.const))
      errors.push(`[${path}] valor deve ser exatamente: ${JSON.stringify(schema.const)}`);

    return errors;
  }

  $('schemaValidate').onclick = () => {
    const el = $('schemaResult');
    try {
      const data   = JSON.parse($('schemaJson').value);
      const schema = JSON.parse($('schemaSchema').value);
      const errors = validate(data, schema);
      if (!errors.length) {
        el.textContent = '✓ JSON válido e conforme o schema!';
        el.className = 'schema-result-ok';
      } else {
        el.textContent = `✗ ${errors.length} erro${errors.length>1?'s':''} encontrado${errors.length>1?'s':''}:\n\n` + errors.join('\n');
        el.className = 'schema-result-err';
      }
    } catch(e) {
      el.textContent = '✗ JSON ou Schema inválido:\n' + e.message;
      el.className = 'schema-result-err';
    }
  };

  $('schemaExample').onclick = () => {
    $('schemaJson').value   = EXAMPLE_JSON;
    $('schemaSchema').value = EXAMPLE_SCHEMA;
    $('schemaResult').textContent = 'Clique em Validar…';
    $('schemaResult').className = '';
  };

  $('schemaClear').onclick = () => {
    $('schemaJson').value=''; $('schemaSchema').value='';
    $('schemaResult').textContent='Preencha os painéis e clique em Validar…';
    $('schemaResult').className='';
  };
})();
