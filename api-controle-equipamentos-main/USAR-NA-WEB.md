# Usar a API na página web

Guia rápido para o frontend web consumir os endpoints.

**Fluxo atual:** O usuário **seleciona o tipo de equipamento** (lista da API) e **digita o ativo/placa** em um campo de texto. Não há mais empresas (donos) nem vínculo com instâncias pré-cadastradas.

---

## 1. URL base

```javascript
const API_BASE = 'http://localhost:3000';  // ou a URL da API em produção
```

---

## 2. Chamadas principais

### Tipos de equipamento (lista para seleção)

```javascript
async function getTiposEquipamento() {
  const res = await fetch(`${API_BASE}/api/equipment-types`);
  if (!res.ok) throw new Error('Erro ao buscar tipos');
  return res.json(); // array com { id, name }
}
```

### Operações do contrato (para a BI)

**Sem filtro (todas as operações do contrato):**
```javascript
const res = await fetch(`${API_BASE}/api/check-operations/contract/${contractId}`);
```

**Com filtro por equipamento (tipo):** use o **id** do tipo (o mesmo de `GET /api/equipment-types`):
```javascript
// Só operações desse tipo de equipamento (ex: Caminhão Basculante Trucado)
const url = `${API_BASE}/api/check-operations/contract/${contractId}?equipmentTypeId=${tipoId}`;
const res = await fetch(url);
```

**Filtro opcional por ativo/placa** (texto digitado):
```javascript
const url = `${API_BASE}/api/check-operations/contract/${contractId}?equipmentTypeId=${tipoId}&ativoPlaca=KWL9432`;
```

Cada operação pode ter:
- **`equipment_type`**: `{ id, name }` — tipo selecionado (ex: "Caminhão Basculante Trucado")
- **`ativo_placa`**: string — valor digitado pelo usuário (ex: "KWL9432", "TRT01")

**Importante para o filtro na BI:** ao escolher um equipamento no filtro, use o **`id`** do tipo (não o nome). A lista de tipos vem de `GET /api/equipment-types`; cada item tem `id` e `name`. Ao filtrar, chame a API com `?equipmentTypeId=` igual a esse `id`. Não use `equipment_id` (antigo) — as operações novas usam `equipment_type_id` e `ativo_placa`.

### Contratos e obras

```javascript
async function getContratos() {
  const res = await fetch(`${API_BASE}/api/contracts`);
  if (!res.ok) throw new Error('Erro ao buscar contratos');
  return res.json();
}

async function getObrasDoContrato(contractId) {
  const res = await fetch(`${API_BASE}/api/contracts/${contractId}/obras`);
  if (!res.ok) throw new Error('Erro ao buscar obras');
  const data = await res.json();
  return data.obras;
}
```

### Municípios da obra

```javascript
async function getMunicipiosDaObra(obraId) {
  const res = await fetch(`${API_BASE}/api/municipalities?obraId=${obraId}`);
  if (!res.ok) throw new Error('Erro ao buscar municípios');
  return res.json();
}
```

---

## 3. Exibir equipamento + ativo na BI

Para cada linha de operação, monte o texto assim:

```javascript
function labelEquipamento(op) {
  if (op.equipment_type?.name && op.ativo_placa) {
    return `${op.equipment_type.name} – ${op.ativo_placa}`;
  }
  return op.equipment?.name ?? op.ativo_placa ?? '—';
}
// Exemplo: "Caminhão Basculante Trucado – KWL9432"
```

---

## 4. Resumo das URLs

| O que | URL |
|-------|-----|
| Tipos de equipamento | `GET /api/equipment-types` |
| Operações do contrato | `GET /api/check-operations/contract/{contractId}` |
| Operações filtradas por equipamento (BI) | `GET /api/check-operations/contract/{contractId}?equipmentTypeId={uuid}` |
| Contratos | `GET /api/contracts` |
| Obras do contrato | `GET /api/contracts/{contractId}/obras` |
| Municípios da obra | `GET /api/municipalities?obraId={obraId}` |
| Equipamentos do contrato (legado) | `GET /api/equipments/contract/{contractId}` |

Não há mais endpoints de empresas (equipment-owners) nem de instâncias (/instances). O ativo/placa é sempre o que o usuário digitou no app.
