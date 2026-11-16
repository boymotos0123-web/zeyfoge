//! ZeyForge Desktop (Tauri v2): janela nativa com aceleração de GPU, diálogos e sistema de arquivos reais.

/// Arquivo .zeyforge passado na linha de comando (duplo clique no arquivo / "Abrir com").
#[tauri::command]
fn startup_file() -> Option<String> {
    std::env::args()
        .skip(1)
        .find(|a| a.to_lowercase().ends_with(".zeyforge") || a.to_lowercase().ends_with(".json"))
}

/// Informações do sistema para o painel "Sobre".
#[tauri::command]
fn system_info() -> String {
    format!("{} {}", std::env::consts::OS, std::env::consts::ARCH)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![startup_file, system_info])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o ZeyForge");
}
