# Preguntes per al germà (CNC) — per enviar per WhatsApp

Missatge a punt d'enviar (de `docs/millores-v1/cnc-mecanitzats.md` §(a)). Les preguntes 1 a 5 ja tenen una opció a l'app
(el valor de sempre, fins que diguis el bo); la 6 i la 7 esperen la resposta per fer-les.

---

Hola! Unes preguntes de la CNC per deixar bé les preferències de l'app. A cada una et poso **el que fa ara** i **el que
proposo**: només cal que diguis OK o el número bo. Tot el que hi ha de l'1 al 5 ja es pot canviar a l'app (et dic on).

**1. Capçalera del programa.** Copio la del teu programa de TopSolid: opcions mecàniques **16777216** (és només el bit 24,
0x01000000) i posició del tauler **(0, −20)**. Em pots enviar una foto del diàleg de *Paràmetres / Opcions mecàniques* del
Maestro amb aquest programa obert, per saber quina casella és? I el −20, què és: els topalls? la càrrega (PLOAD)? És igual
per a tots els gruixos? I els números de la macro PLOAD (1, 0, 1, 0, 4, 2, false, 0, 0, 0, 0), què volen dir?
*A l'app: Preferències › Màquines CNC › (la màquina) › «Programes per tauler (nesting)» › Capçalera: opcions mecàniques (amb
els bits al costat), posició X / Y / Z i gir, i els paràmetres de Pload.*

**2. Marge del tauler.** Ara: **10 mm**. Al teu programa les peces van a **12 mm de la vora** (= la fresa de 12, que es menja
tota la vora). Proposo: **marge = Ø de la fresa** (12; 14 amb la de 14). OK?
*A l'app: Preferències › Màquines CNC › «Programes per tauler (nesting)» › «Marge del tauler»: «Fix» (10) o «Ø de la fresa +»
(i els mm de més que vulguis).*

**3. Forats gairebé passants.** Al teu programa: Ø4 × **18,9** en tauler de 19 (0,1 de pell). Són pilots per a cargols?
Ara, si un forat passa de gruix − 0,5, el deixo a **gruix − 1** (1 mm de pell). Proposo: **pell mínima 0,1 mm** com tu. OK,
o prefereixes una altra xifra?
*A l'app: Preferències › Regles de mecanitzat › «Forats i ranures gairebé passants»: «Pell mínima» (ara 1) i «A partir de»
(ara 0,5).*

**4. Sentit dels talls.** TopSolid fa els contorns de fora antihoraris i els forats de dins **horaris** (així tot és fresat
*en oposició*). Ara jo faig els de dins antihoraris (quedarien *en concordança*). Proposo: **tot en oposició, com TopSolid**.
OK, o vols concordança?
*A l'app: Preferències › Regles de mecanitzat › «Sentit dels contorns i talls»: «Com surt» (el d'ara), «En oposició (com
TopSolid)» o «En concordança». A Exportar › Vista CAM cada contorn porta una punta amb el sentit.*

**5. Fitxer .xcs.** Ara surt en UTF-8 **amb BOM**; el teu és ASCII pur. Proposo: **sense BOM**, igual que el teu. Si pots,
obre el `nesting_T01.xcs` que et vaig passar i digues si el Maestro dona algun error a la primera línia.
*A l'app: Preferències › Màquines CNC › «Programes .xcs» › «Codificació»: «UTF-8 amb BOM» (el d'ara) o «Sense BOM (com
TopSolid)».*

**6. Perfil LED encastat al prestatge.** Ara el poso per sota, sense ranura. Proposo: ranura de **17 × 8 mm**, eix a **30 mm
del davant**, passant de lateral a lateral, feta a la teva màquina girant el prestatge (cara de sota amunt), amb un forat
**Ø10** a un extrem per al cable. Quin perfil fas servir (mides)? Ranura passant o aturada? Fresa de 8 en passades o la de 16?

**7. Portes de vidre amb marc d'alumini.** Ara: al cos només la filera de forats de 32 (placa a **37 mm** del davant), i al
marc res. Quina frontissa fas servir (marca/model)? El marc ja ve mecanitzat del proveïdor? La placa del cos és la normal
(Ø5 a 32) o una altra? O prefereixes pius a dalt i a baix?

Gràcies!!
