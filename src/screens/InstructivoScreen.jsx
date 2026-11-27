export default function InstructivoScreen({ onBack }) {
  return (
    <div className="screen instructivo-screen">
      <header className="app-header row">
        <button className="ghost-btn" onClick={onBack}>← Volver al menú</button>
        <div className="grow">
          <h1>Instructivo de Uso</h1>
          <p className="subtitle">Guía de variables, metodología e interpretación de resultados</p>
        </div>
      </header>

      <div className="instr-body">

        <section className="card">
          <h2>¿Qué es un Estudio de Tiempos en Línea?</h2>
          <p>
            El estudio de tiempos es una técnica de ingeniería industrial que consiste en medir el tiempo
            que emplea un operario calificado en realizar cada operación de su puesto de trabajo, bajo
            condiciones normales de trabajo. Permite identificar ineficiencias, equilibrar la línea de
            producción y establecer tiempos estándar de referencia.
          </p>
        </section>

        <section className="card">
          <h2>Flujo de uso de la aplicación</h2>
          <ol className="flow-list">
            <li>
              <span className="step-num">1</span>
              <div>
                <strong>Datos del estudio</strong> — Ingresá analista, operario, modelo, capacidad y línea (IDU/ODU).
              </div>
            </li>
            <li>
              <span className="step-num">2</span>
              <div>
                <strong>Takt Time</strong> — Indicá el tiempo de ciclo requerido por el cliente en segundos.
                Se usará para detectar cuellos de botella en resultados.
              </div>
            </li>
            <li>
              <span className="step-num">3</span>
              <div>
                <strong>Definir puestos</strong> — Indicá cuántos puestos tiene la línea y el nombre de cada uno
                (ej: "Armado de chasis", "Conexionado eléctrico", "Embalaje final").
              </div>
            </li>
            <li>
              <span className="step-num">4</span>
              <div>
                <strong>Configurar acciones</strong> — Para cada puesto agregá las operaciones con descripción.
                Podés subir fotos y videos cortos (hasta 100 MB) del puesto o de la hoja de proceso como referencia: desde la galería o tomándolos en el momento. Se guardan en la nube y los ve todo el equipo; durante la medición los abrís con “Ver referencia”. Podés elegir la calidad del video (360p, 480p o 720p): cuanto más baja, más rápido se comprime y sube; 480p alcanza para ver cómo se hace la tarea. Las subidas siguen en segundo plano aunque cambies de pantalla, y si se corta la conexión se reintentan solas.
              </div>
            </li>
            <li>
              <span className="step-num">5</span>
              <div>
                <strong>Medir tiempos</strong> — Usá los cronómetros individuales por acción o el cronómetro
                general del puesto. Presioná ▶ para iniciar, ⏹ para parar y registrar, ↺ para rehacer.
              </div>
            </li>
            <li>
              <span className="step-num">6</span>
              <div>
                <strong>Analizar resultados</strong> — Revisá T Real, T Normal y comparación contra Takt Time.
                Exportá a Excel o PDF y detectá los puestos críticos.
              </div>
            </li>
          </ol>
        </section>

        <section className="card">
          <h2>Variables del estudio</h2>
          <div className="var-table">

            <div className="var-row">
              <div className="var-name">T Real<br/><span className="var-sub">Tiempo Medido</span></div>
              <div className="var-def">
                Tiempo efectivamente registrado con el cronómetro durante el estudio.
                Se expresa en segundos (decimal) y en formato MM:SS:CC (minutos : segundos : centésimas).
              </div>
            </div>

            <div className="var-row">
              <div className="var-name">T Normal<br/><span className="var-sub">Tiempo Normalizado</span></div>
              <div className="var-def">
                Tiempo real ajustado por la valoración del ritmo del operario:<br/>
                <code>T Normal = T Real × (Valoración / 100)</code><br/>
                Permite comparar tiempos entre operarios con distintos ritmos de trabajo.
              </div>
            </div>

            <div className="var-row">
              <div className="var-name">Valoración<br/><span className="var-sub">Ritmo del operario</span></div>
              <div className="var-def">
                Porcentaje que indica si el operario trabajó más rápido ({">"} 100%) o más lento ({"<"} 100%)
                que el ritmo normal. Se ingresa al registrar cada toma y es 100% por defecto.
              </div>
            </div>

            <div className="var-row">
              <div className="var-name">Takt Time<br/><span className="var-sub">Tiempo de ciclo cliente</span></div>
              <div className="var-def">
                Ritmo de producción requerido para satisfacer la demanda del cliente.<br/>
                <code>Takt Time = Tiempo disponible / Demanda del cliente</code><br/>
                En resultados se compara el T Real total de cada puesto contra el Takt Time.
                Un puesto con T Real &gt; Takt Time es un <strong>cuello de botella</strong> y limita
                la capacidad de toda la línea.
              </div>
            </div>

            <div className="var-row">
              <div className="var-name">IDU<br/><span className="var-sub">Indoor Unit</span></div>
              <div className="var-def">
                Unidad interior del equipo de aire acondicionado (evaporadora).
                La línea IDU ensambla y controla la calidad de la unidad que se instala en el interior del ambiente.
              </div>
            </div>

            <div className="var-row">
              <div className="var-name">ODU<br/><span className="var-sub">Outdoor Unit</span></div>
              <div className="var-def">
                Unidad exterior del equipo (condensadora). La línea ODU ensambla el compresor,
                el condensador y el ventilador que se instalan fuera del ambiente.
              </div>
            </div>

            <div className="var-row">
              <div className="var-name">ODU2<br/><span className="var-sub">Outdoor Unit variante</span></div>
              <div className="var-def">
                Variante de unidad exterior utilizada en los modelos Wrac y Portátil,
                con proceso de ensamblado diferente al ODU estándar.
              </div>
            </div>

          </div>
        </section>

        <section className="card">
          <h2>Indicadores y colores en resultados</h2>
          <div className="badge-guide">
            <div className="bg-row">
              <span className="badge ok">OK</span>
              <span>T Real del puesto dentro del Takt Time. Puesto equilibrado.</span>
            </div>
            <div className="bg-row">
              <span className="badge bottleneck">Cuello de botella</span>
              <span>T Real del puesto completo supera el Takt Time. Limita la capacidad de la línea.</span>
            </div>
            <div className="bg-row">
              <span className="badge pend">Pendiente</span>
              <span>Puesto o acción no medida en este estudio. No influye en los totales.</span>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Cómo usar el cronómetro</h2>
          <p>
            La aplicación adapta automáticamente el modo de medición según cómo configures los puestos:
          </p>
          <div style={{ backgroundColor: 'var(--bg2)', padding: '14px', borderRadius: '6px', marginTop: '12px', marginBottom: '12px' }}>
            <div style={{ marginBottom: '12px' }}>
              <strong>Modo "Por Elemento"</strong> (si agregaste acciones al puesto):<br/>
              <span style={{ display: 'block', marginTop: '6px', color: 'var(--text2)', fontSize: '0.9rem' }}>
                Cada acción tiene su propio cronómetro. Presioná <strong>▶ Iniciar</strong> antes de ejecutar
                la acción, <strong>⏹ Pausar</strong> al terminar. El tiempo se registra automáticamente.
                Podés registrar múltiples tomas de la misma acción para obtener un promedio.
              </span>
            </div>
            <div>
              <strong>Modo "Por Puesto"</strong> (si NO agregaste acciones):<br/>
              <span style={{ display: 'block', marginTop: '6px', color: 'var(--text2)', fontSize: '0.9rem' }}>
                Se mide el tiempo total del puesto sin desglosar por acciones. Usá el cronómetro general
                en el encabezado: presioná <strong>▶ Iniciar</strong> al comenzar, <strong>⏹ Pausar</strong>
                al terminar todo el ciclo. Podés registrar múltiples observaciones del ciclo completo.
              </span>
            </div>
          </div>
          <p style={{ marginTop: '12px', marginBottom: '0' }}>
            <strong>Resumen:</strong> Acciones definidas = mide por elemento. Sin acciones = mide puesto completo.
          </p>
        </section>

        <section className="card">
          <h2>Formato MM:SS:CC</h2>
          <p>
            Todos los cronómetros miden en <strong>MM (minutos) : SS (segundos) : CC (centésimas de segundo)</strong>.
            Esto permite registrar tiempos cortos con precisión.
          </p>
          <p style={{ marginTop: '10px' }}>
            <strong>Ejemplo:</strong> <code className="mono-ex">02:34:07</code> = 2 min, 34 seg, 7 centésimas = 154,07 segundos.
          </p>
        </section>

        <section className="card">
          <h2>Exportación de datos</h2>
          <p>
            Desde la pantalla de resultados podés exportar los datos en dos formatos:
          </p>
          <ul style={{ marginTop: '10px', paddingLeft: '20px', lineHeight: '1.8' }}>
            <li>
              <strong>Excel (.xlsx)</strong> — Incluye dos hojas: <em>Estudio</em> con el resumen por puesto/acción
              (T Real prom, T Normal prom, MM:SS:CC, tomas) y <em>Tomas individuales</em> con el detalle de cada toma
              registrada (tiempo, valoración, T Normal). Los encabezados en <span style={{ color: '#4472c4' }}>azul</span> son
              datos ingresados por el usuario; los encabezados en gris son calculados automáticamente.
            </li>
            <li style={{ marginTop: '6px' }}>
              <strong>PDF (.pdf)</strong> — Resumen ejecutivo con encabezado del estudio, tabla general de resultados
              y detalle por puesto. Incluye numeración de páginas.
            </li>
          </ul>
          <p style={{ marginTop: '10px' }}>
            Los archivos se nombran automáticamente: <code className="mono-ex">toma-tiempos-[Modelo]-[Capacidad]-[Línea]-[Fecha]</code>
          </p>
        </section>

        <section className="card">
          <h2>Flujo completo de un estudio</h2>
          <ol className="flow-list" style={{ marginTop: '12px' }}>
            <li>
              <span className="step-num">1</span>
              <div>
                <strong>Menú de inicio</strong> — Ingresá los datos del estudio (analista, modelo, capacidad, línea).
                Estos datos aparecerán en encabezados de reportes y exportaciones.
              </div>
            </li>
            <li>
              <span className="step-num">2</span>
              <div>
                <strong>Configurar Takt Time</strong> — Indicá el ritmo de producción requerido en segundos.
                Será la referencia para detectar cuellos de botella. Podés dejar vacío si no aplica.
              </div>
            </li>
            <li>
              <span className="step-num">3</span>
              <div>
                <strong>Definir puestos de trabajo</strong> — En "Acciones por puesto", agregá cada estación de la línea
                con su nombre, operario (opcional) e imagen de referencia. Para cada puesto decidís si medirás por elemento
                (detallar acciones) o por puesto completo (sin acciones).
              </div>
            </li>
            <li>
              <span className="step-num">4</span>
              <div>
                <strong>Agregar acciones (opcional)</strong> — Si seleccionás un puesto y agregás acciones, la app entrará
                automáticamente en modo "Por Elemento". Completá la descripción de cada operación. Si no agregás acciones,
                será modo "Por Puesto".
              </div>
            </li>
            <li>
              <span className="step-num">5</span>
              <div>
                <strong>Usar plantillas (opcional)</strong> — Si ya tenés configurado un puesto similar en otro estudio,
                podés guardar su estructura como plantilla y reutilizarla en futuros estudios. Las plantillas se almacenan
                por modelo, así que siempre las tenés disponibles.
              </div>
            </li>
            <li>
              <span className="step-num">6</span>
              <div>
                <strong>Iniciar toma de tiempos</strong> — Presioná "Iniciar Estudio" para comenzar. Navegá entre puestos
                con las pestañas. Para cada puesto/acción, usá el cronómetro: presioná ▶ para iniciar, ⏸ para pausar.
                Si necesitás, podés cargar un tiempo manualmente o esperar a que se complete la medición.
              </div>
            </li>
            <li>
              <span className="step-num">7</span>
              <div>
                <strong>Registrar tomas</strong> — Una vez pausado el cronómetro, podés guardar una toma intermedia
                (💾 Guardar, reinicia el contador) o registrar definitivamente (✓ Registrar, guarda y reinicia).
                Registrá múltiples observaciones de cada acción/puesto para obtener un promedio confiable.
              </div>
            </li>
            <li>
              <span className="step-num">8</span>
              <div>
                <strong>Ajustar valoración</strong> — Mientras registrás, podés cambiar el % de valoración del ritmo del
                operario (50–150%). Esto afecta el T Normal. 100% = ritmo normal.
              </div>
            </li>
            <li>
              <span className="step-num">9</span>
              <div>
                <strong>Agregar comentarios</strong> — Para cada puesto, podés escribir observaciones (cambios de ritmo,
                pausas, incidentes). Estos comentarios aparecerán en reportes.
              </div>
            </li>
            <li>
              <span className="step-num">10</span>
              <div>
                <strong>Ver resultados</strong> — Presioná "Ver Resultados" en el pie de pantalla. Se muestra un resumen
                completo con promedios, análisis de Takt Time, gráficos y detalle por puesto. Aquí podés revisar todas las
                tomas y sus promedios calculados.
              </div>
            </li>
            <li>
              <span className="step-num">11</span>
              <div>
                <strong>Exportar y archivar</strong> — Exportá a Excel (dos hojas: resumen y detalle) o PDF (reporte ejecutivo).
                Los archivos se descargan automáticamente con nombre estándar. Archivá según tu proceso de calidad.
              </div>
            </li>
          </ol>
        </section>

        <section className="card">
          <h2>Problemas y Análisis — cómo usar cada herramienta</h2>
          <p>
            Desde el menú principal, <strong>Problemas y Análisis</strong> permite registrar un problema, analizarlo y
            seguirlo en equipo. Todos ven los mismos problemas en tiempo real, con responsable, comentarios y plan de acción.
            Podés crear uno desde cero o, en <em>Resultados</em>, con el botón <strong>🔎 Analizar cuello de botella</strong>
            de un puesto (se carga con la medición de ese puesto).
          </p>
          <div className="var-table" style={{ marginTop: 12 }}>
            <div className="var-row">
              <div className="var-name">5 Porqués<br/><span className="var-sub">Causa raíz</span></div>
              <div className="var-def">
                Preguntá &ldquo;¿por qué?&rdquo; sobre el problema y sobre cada respuesta hasta llegar a algo que puedas corregir
                (normalmente 4 o 5 veces). Respondé con hechos verificados y no culpes personas: preguntá por qué el proceso lo permitió.
                <br/><em>Ej: pierde aceite → unión floja → no se aplicó torque → no había torquímetro en el puesto → no está en la hoja de proceso.</em>
              </div>
            </div>
            <div className="var-row">
              <div className="var-name">Ishikawa<br/><span className="var-sub">Espina de pescado (6M)</span></div>
              <div className="var-def">
                Ordena todas las causas posibles en seis familias: Mano de obra, Máquina, Método, Material, Medición y Medio ambiente.
                Úsalo cuando no sabés por dónde empezar o en una lluvia de ideas con el equipo: anotá una causa por línea y después
                verificá las más probables en el puesto.
              </div>
            </div>
            <div className="var-row">
              <div className="var-name">Plan de acción<br/><span className="var-sub">Tareas con dueño y fecha</span></div>
              <div className="var-def">
                Por cada causa raíz confirmada definí una acción que la elimine, con un responsable y una fecha. Actualizá el estado
                (Pendiente, En curso, Hecha). Cuando estén todas hechas, verificá en el puesto que no vuelve a aparecer y pasá el
                problema a <em>Cerrado</em>.
              </div>
            </div>
            <div className="var-row">
              <div className="var-name">Pareto<br/><span className="var-sub">Lo que más pesa (80/20)</span></div>
              <div className="var-def">
                Cargá categorías (defectos, causas, paradas) con su cantidad. El gráfico las ordena de mayor a menor y muestra el % acumulado:
                las que llegan hasta ~80% son las prioritarias. También hay un Pareto de todos los problemas (por puesto, tipo, severidad o línea)
                desde la lista.
              </div>
            </div>
            <div className="var-row">
              <div className="var-name">8D<br/><span className="var-sub">Reporte formal en 8 pasos</span></div>
              <div className="var-def">
                D1 Equipo · D2 Descripción · D3 Contención · D4 Causa raíz (y punto de escape) · D5 Acciones correctivas · D6 Validación ·
                D7 Prevención · D8 Cierre. Varias secciones se completan con lo que ya cargaste. Es el formato que suelen pedir clientes y calidad.
              </div>
            </div>
            <div className="var-row">
              <div className="var-name">5W2H<br/><span className="var-sub">Definir con 7 preguntas</span></div>
              <div className="var-def">
                Qué, Por qué, Dónde, Cuándo, Quién, Cómo y Cuánto. Evita que cada persona entienda el problema (o la solución) de forma distinta.
                Un &ldquo;no sé&rdquo; es una tarea de investigación pendiente.
              </div>
            </div>
            <div className="var-row">
              <div className="var-name">Es / No es<br/><span className="var-sub">Acotar el problema</span></div>
              <div className="var-def">
                Comparás qué, dónde, cuándo y cuánto <em>sí</em> ocurre contra lo que podría ocurrir pero <em>no</em> ocurre. La causa suele estar en la diferencia.
              </div>
            </div>
            <div className="var-row">
              <div className="var-name">Matriz impacto / esfuerzo<br/><span className="var-sub">Priorizar acciones</span></div>
              <div className="var-def">
                Clasificá cada acción por impacto y esfuerzo: hacé primero los Quick wins (alto impacto, bajo esfuerzo), planificá los Proyectos grandes
                y descartá lo de bajo impacto y alto esfuerzo.
              </div>
            </div>
            <div className="var-row">
              <div className="var-name">Contención<br/><span className="var-sub">Acción inmediata</span></div>
              <div className="var-def">
                Lo que hacés ya mismo para que el problema no siga afectando la producción (separar material, inspección al 100%, etc.),
                mientras se analiza la causa raíz.
              </div>
            </div>
          </div>
          <p style={{ marginTop: 10 }}>
            Cada herramienta tiene su botón <strong>💡 ¿Cómo se usa?</strong> con una guía y un ejemplo. El análisis se puede
            exportar a PDF desde la pantalla del problema.
          </p>
        </section>

        <section className="card">
          <h2>Consejos prácticos</h2>
          <ul style={{ marginTop: '10px', paddingLeft: '20px', lineHeight: '1.8' }}>
            <li>
              <strong>Espera a que el operario esté en ritmo normal</strong> — Las primeras 2–3 tomas pueden ser más lentas.
              Registrá desde la 3ª o 4ª para evitar sesgos.
            </li>
            <li style={{ marginTop: '6px' }}>
              <strong>Varía el número de tomas según complejidad</strong> — Acciones simples: 5–8 tomas. Complejas: 10–15 tomas.
              Cuantas más tomas, más confiable el promedio.
            </li>
            <li style={{ marginTop: '6px' }}>
              <strong>Si hay interrupciones</strong> — Tomá nota de pausas, cambios, problemas. Escribílo en comentarios.
              Podés decidir después si reperir esas tomas o considerarlas "como es".
            </li>
            <li style={{ marginTop: '6px' }}>
              <strong>Usa la valoración como herramienta</strong> — Si el operario trabajó rápido (100% + 15%), ingresá 115%.
              Si fue lento (100% - 20%), ingresá 80%. El T Normal se ajusta automáticamente.
            </li>
            <li style={{ marginTop: '6px' }}>
              <strong>Revisa los gráficos</strong> — En resultados, el gráfico de barras vs Takt Time te muestra de un vistazo
              qué puestos son cuellos de botella. Rojo = problema; verde = OK.
            </li>
            <li style={{ marginTop: '6px' }}>
              <strong>Guarda plantillas de puestos recurrentes</strong> — Si medís la misma línea múltiples veces, guarda la
              configuración como plantilla. Reutilizá en futuros estudios para ganar velocidad.
            </li>
          </ul>
        </section>

      </div>
    </div>
  );
}
