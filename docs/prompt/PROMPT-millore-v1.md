# Preguntes per al meu germà

## 1. Preguntes sobre mecanitzats i Preferències

La idea principal és preguntar-li quines opcions haurien de ser les **preferències estàndard i més lògiques** i, al mateix temps, permetre que el meu germà les pugui modificar quan sigui necessari.

* Què vol dir l’opció mecànica **16777216**? I què significa el **−20** de la posició de la peça?
* El marge del tauler és sempre igual al **Ø de la fresa**? Al fitxer real, les peces queden a **12 mm de la vora**, mentre que nosaltres hi posem **10 mm**.
* Quanta pell deixa als forats gairebé passants? Al fitxer real fa forats de **Ø4 × 18,9 mm** en un tauler de 19 mm.
* Els talls interiors els fa en **sentit horari** expressament?
* El Maestro accepta **UTF-8 amb BOM**? El fitxer real és **ASCII pur**.
* El perfil LED d’alumini normalment va encastat en una ranura del prestatge. Quina mida ha de tenir la ranura i a quina distància del davant? Com es mecanitza això a Preferències?
* Per a les frontisses de les portes de vidre, quines frontisses utilitza per a un **marc d’alumini**?

---

# 2. Petits detalls

### Cursor

La visualització del cursor ja funciona bé a la majoria de llocs.

Però, quan es passa per sobre d’una acció concreta i aquesta no té un cursor definit, estaria bé que es mostrés el **cursor bàsic de fletxa**.

---

# 3. Canvis a l’app de Mobles

### Vistes

A les opcions de vista:

* Davant
* Darrere
* Esquerra
* Dreta
* Dalt

Eliminar les vistes actuals que simplement mouen la càmera 3D.

No cal mostrar-hi les mides; aquestes vistes haurien de servir simplement per posicionar la càmera.

---

### Peces lliures i Objectes de referència

A **Peces lliures** i **Objectes de referència**, eliminar el grup d’opcions **General**.

Posar cada apartat directament com un acordió independent:

* Efecte
* Orientació
* Material
* Forma
* Grup
* CNC
* Enganxada

Cadascun amb el seu corresponent icono.

---

### Tipus de moble

A **Mobles**, l’opció **Tipus** no ens fa falta.

Les primeres opcions:

* Moble
* Cuina
* Armari
* Taula

ja poden fer aquesta funció.

En el cas de **Cuina**, el sòcol i el taulell es poden fer amb **Peces lliures**.

L’opció **Flat-pack** tampoc faria falta, perquè són peces lliures que ja entren al nesting.

A més, les peces lliures ja tenen l’opció **Encaixos**, que seria precisament el que correspondria al concepte de Flat-pack.

Per tant, **Flat-pack hauria de ser una opció de les peces lliures**, no un tipus de moble.

---

### Objectes i models 3D

A **Objectes**, no fan falta els **Objectes de referència**.

A **Mobles**, no fa falta l’apartat **Models 3D**.

---

### Selecció del pare

A **Mobles**, quan se selecciona el pare, actualment apareix l’opció **Front** per a tot el mòdul.

Aquesta opció s’hauria d’eliminar del nivell pare, perquè les opcions haurien d’aparèixer quan se selecciona l’element corresponent.

Quan se selecciona l’interior del moble o una divisió, ja apareixen les opcions:

* Ober
* Porta
* Front fix

Aquesta estructura hauria de ser coherent.

---

### Acordions

En general, a tota l’app, l’acordió hauria de ser sempre el mateix component:

`Accordion` de `@chakra-ui/react`.

No hauríem de crear diferents sistemes d’acordió segons l’apartat.

---

### Menú principal

Nou ordre del menú principal:

1. Mobles
2. Ambients
3. Objectes

El botó **+ / Add** es podria posar al costat del buscador.

---

### Historial

Al historial hi ha un botó que diu:

**«Esborrar l’historial»**

Canviar-lo simplement per:

**«Esborrar»**

---

# 4. Finestra de Render

A l’acordió de la part dreta, no sé si és la part interior o exterior del contenidor, però hi posaria **3 px de padding**.

Actualment, quan se selecciona un checkbox, la part esquerra queda una mica tallada.

### Llums

L’opció **Llums** té moltes opcions.

Fer-hi un acordió amb subcategories:

* Sol
* Cel
* Llum

---

# 5. Ambients

### Eina de ploma

A Ambients, l’eina de ploma actualment no permet fer corbes.

Estaria bé poder:

* Importar fitxers **.EPS**
* Importar fitxers **.DXF**
* Utilitzar-los com a plànols o formes de fons.

---

### Desar ambients

Els ambients es podrien poder **«Desar com a fitxer»**.

El fitxer hauria de guardar:

* Els mobles utilitzats.
* Els seus plànols.
* La vista/càmera.
* La configuració del render.
* La resta d’elements necessaris de l’ambient.

Quan s’obri un ambient, s’hauria de buscar si els mobles encara existeixen.

Si algun moble ja no existeix, simplement no hauria d’aparèixer o s’hauria d’indicar que falta.

---

### Selecció dels ambients

A Ambients, al menú de l’esquerra no apareix el nom de l’ambient per poder-lo seleccionar.

Només es pot seleccionar des de la vista central.

En canvi, als altres apartats sí que tenim una zona de selecció i, a més, hi apareix un resum.

Hauríem de plantejar si això hauria de tenir la mateixa estructura a tota l’aplicació.

La idea és que hi hagi **coherència i cohesió** a tot el programa:

> Si una cosa es busca o es selecciona d’una determinada manera en un apartat, hauria de funcionar de manera semblant en els altres.

Això fa que el programa sigui molt més fàcil d’entendre i d’utilitzar.

---

### Materials

A l’edició del material, fer la **bola de previsualització** més gran que la textura plana.

---

# 6. Peces lliures

### Editor de formes

A **Peces lliures → Forma → Ploma**, afegir funcionalitats de teclat.

Per exemple:

* Quan s’està dibuixant una corba, mantenir premuda la tecla **Majúscules** per convertir el segment en recte.
* Afegir un botó per importar **.EPS**.
* Afegir un botó per importar **.DXF**.
* Afegir **Undo / Redo**.
* Millorar l’editor perquè sigui més semblant a eines com **Figma**.

Ara mateix, per a determinades formes, resulta més fàcil dibuixar-les en un programa extern i després portar-les a l’aplicació.

La idea seria millorar l’editor perquè sigui prou potent i còmode per fer-ho directament dins de l’aplicació.

---

# 7. Regla d’or: coherència i cohesió

Això hauria de ser una **regla d’or per a tota l’aplicació**.

Quan es vulgui crear una funcionalitat nova, primer s’hauria de mirar:

> **Com està resolta aquesta necessitat en un altre lloc de l’aplicació?**

Si ja existeix una solució, s’hauria de reutilitzar abans de crear-ne una de nova.

Això permet:

* No repetir codi.
* No crear components diferents per fer la mateixa funció.
* Evitar comportaments incoherents.
* Facilitar el manteniment.
* Facilitar la comprensió del programa.
* Fer que l’usuari sempre trobi les coses al mateix lloc i de la mateixa manera.

Per exemple, l’altre dia amb les **llums dels materials**.

En editar un material es va afegir una nova opció **«Al render»**, però no s’havia comprovat realment com funcionava al render.

A més, en la previsualització del material, la bola no reflecteix realment els efectes de llum.

Abans d’afegir una opció nova, s’hauria de comprovar com està resolt el mateix concepte a la resta de l’aplicació i si realment funciona de principi a fi.

---

# 8. Estudi dels ferratges dels proveïdors

Proveïdors que hauríem d’estudiar:

* https://www.hettich.com
* https://www.blum.com
* https://swood.eficad.com

Aquests proveïdors també tenen eines i aplicacions relacionades amb el disseny de mobles i els ferratges.

Estaria bé estudiar-les per agafar idees i veure com resolen determinats problemes que nosaltres també tindrem.

---

# 9. Com gestionar els ferratges?

Hem de decidir com integrar els ferratges dins de l’aplicació.

### On es gestionaran?

* A **Preferències**?
* O crear un apartat específic de **Ferratges**?

### Representació

Com els visualitzarem?

* En 3D?
* Amb un dibuix 2D?
* Amb les dues opcions?

### Aplicació al moble

Com aplicarem un ferratge a un moble?

Per exemple:

* Seleccionar un ferratge.
* Seleccionar la peça o peces afectades.
* Definir la posició.
* Aplicar automàticament les mecanitzacions necessàries.

### Categories

Com els classificarem?

Per exemple:

* Frontisses
* Cargols
* Minifix
* Excèntriques
* Guies
* Potes
* Tiradors
* Perfils
* Ferratges d’unió
* Ferratges per a vidre
* Ferratges d’alumini
* Etc.

### Importació

Com importarem els ferratges?

* STEP
* DXF
* Altres formats 3D
* Biblioteques dels fabricants

Hauríem d’estudiar si podem fer alguna cosa similar al que fa **SolidWorks** amb les biblioteques i components.

---

# 10. Visualització dels ferratges

Perquè el procés sigui lleuger, podríem tenir diferents nivells de visualització.

### Mode ràpid

Mostrar només:

* Forats
* Fresats
* Mecanitzacions necessàries per al nesting

### Mode simplificat

Mostrar només una representació simplificada del ferratge, per exemple un **cub o volum aproximat** que representi l’espai que ocupa.

### Mode 3D

Mostrar el ferratge complet en 3D.

D’aquesta manera, quan estem treballant ràpidament no carreguem models 3D innecessaris.

I quan necessitem comprovar alguna cosa, podem activar la visualització completa per veure:

* L’espai que ocupa.
* Les interferències.
* La posició.
* Si el ferratge és correcte.
* Com queda realment dins del moble.

---

# 11. Estudi general i organització del desenvolupament

Dit tot això, jo faria un **estudi general del conjunt de millores** abans de començar a implementar-les.

Si vols, pots consultar també altres agents experts perquè analitzin diferents parts del projecte.

La idea seria distribuir la feina entre diversos agents:

### Fase 1 — Estudi

Cada agent analitza una àrea:

* UX/UI
* Arquitectura del programa
* CNC i mecanitzats
* Ferratges
* 3D
* Render
* Materials
* Ambients
* Mobles
* Nesting
* Importació/exportació
* Coherència de l’aplicació

### Fase 2 — Documentació

Cada agent crea documentació sobre:

* Com funciona actualment.
* Què es podria millorar.
* Quines opcions existeixen.
* Quines dependències hi ha.
* Quines modificacions poden afectar altres parts del programa.

### Fase 3 — Revisió i unificació

Després, revisar tota la documentació conjuntament per detectar:

* Duplicacions.
* Contradiccions.
* Funcionalitats repetides.
* Components que es poden reutilitzar.
* Decisions que haurien de ser comunes a tota l’aplicació.

### Fase 4 — Priorizació

Ordenar les millores per:

1. Imprescindibles.
2. Importants.
3. Millores d’usabilitat.
4. Millores de rendiment.
5. Millores futures.

### Fase 5 — Implementació

Un cop definit tot això, distribuir la implementació entre agents perquè es pugui avançar en paral·lel quan no hi hagi dependències entre tasques.

### Fase 6 — Revisió

Fer rondes de revisió després de cada bloc important:

* Revisió funcional.
* Revisió visual.
* Revisió d’arquitectura.
* Revisió de coherència.
* Revisió de codi.
* Revisió de regressions.

I anar millorant les **regles d’or del projecte** a mesura que apareguin nous casos.

La idea final seria que, abans de fer una funcionalitat nova, sempre es comprovi si ja existeix una solució equivalent dins de l’aplicació i, si existeix, reutilitzar-la o convertir-la en un component general.

Així aconseguirem que el programa sigui cada vegada **més coherent, més fàcil d’utilitzar, més fàcil de mantenir i més fàcil d’ampliar**.
