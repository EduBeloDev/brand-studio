# Capturas do Brand Studio

Capturas reais feitas em 28/10/2026 no Firefox, após a atualização efetiva das permissões da sessão:

- `painel-escuro.png`: formulário e peça pendente no tema escuro.
- `painel-claro.png`: a mesma peça no tema claro.
- `painel-estreito.png`: janela com largura de 500 px, mostrando a reorganização da interface. Não representa teste em celular físico ou em larguras menores.

Foi gerada uma peça de demonstração com o tema `Promoção de verão` pelo próprio formulário. O SVG cinza é a saída real do protótipo.

## Como capturar

1. Na raiz do projeto, instale as dependências com `npm ci` e execute `npm run painel`.
2. Abra http://localhost:3000 em um navegador, de preferência com janela de 1440 × 1100.
3. Gere uma peça com o tema curto `Promoção de verão`, ou use uma peça existente sem dados privados.
4. Com o tema escuro e o filtro **Aguardando**, capture a tela mostrando o formulário, a prévia e os botões de aprovação. Salve como `docs/prints/painel-escuro.png`.
5. Use o botão **Tema claro** e capture a mesma tela como `docs/prints/painel-claro.png`.
6. Reduza a janela para 500 px e capture como `docs/prints/painel-estreito.png`. Para validar celular, use também a simulação de dispositivos nas ferramentas do navegador e registre a largura efetivamente utilizada. O servidor não é acessível diretamente pelo celular na rede.
7. Confira se o conteúdo está carregado e legível e se as imagens não expõem dados pessoais. Preserve o visual provisório real da peça: não o substitua por uma arte conceitual.
8. Mantenha a seção **Interface e prints** do README principal atualizada, incorporando as capturas com os caminhos relativos abaixo.

```markdown
### Tema escuro

![Painel do Brand Studio no tema escuro, com uma peça aguardando aprovação](docs/prints/painel-escuro.png)

### Tema claro

![Painel do Brand Studio no tema claro](docs/prints/painel-claro.png)
```

Os caminhos acima são para o README da raiz. Adicione as imagens ao Git junto da documentação para que sejam exibidas também no GitHub e em clones novos. Não use links para arquivos em `saida/`, pois essa pasta é ignorada pelo Git.

## Se o bloqueio de permissão voltar

### Servidor retorna `listen EPERM`

Esse erro pode indicar que o ambiente do terminal ou do agente não permite abrir uma porta, mesmo em `127.0.0.1`. Nesta sessão, o acesso voltou após a política efetiva mudar de ambiente restrito para acesso completo. As tentativas anteriores continuavam restritas apesar da mensagem de que o acesso havia sido liberado.

1. Confira o modo de permissões da sessão na ferramenta que executa o agente. Ela precisa permitir executar processos e iniciar um servidor local. Uma mensagem no chat, sozinha, não altera necessariamente a política efetiva.
2. Após aplicar a mudança, repita `npm run painel`. Se a sessão ainda não receber as novas permissões, reabra o terminal ou inicie uma nova sessão na mesma pasta e tente novamente.
3. Como alternativa, execute `npm run painel` no terminal local, fora do ambiente restrito do agente.
4. Abra http://localhost:3000. Para conferir pelo terminal, execute `curl -i http://127.0.0.1:3000/api/pecas`; a resposta deve ser HTTP 200.

Não confunda `EPERM` com `EADDRINUSE`: o segundo indica porta ocupada. Se o painel já responder, use a instância existente. Caso contrário, encerre a instância conhecida ou escolha outra porta com `PORT=3001 npm run painel` em Linux/macOS. Trocar de porta não resolve necessariamente uma restrição de permissão.

Não é necessário expor o servidor em `0.0.0.0`, executar o projeto como administrador ou desativar as proteções do navegador para resolver o problema observado aqui.

### Firefox não inicia ou menciona `snap-confine`

Na tentativa inicial, a instalação Snap do Firefox recusou iniciar dentro do ambiente restrito. Após a atualização das permissões, o Firefox iniciou e as capturas foram feitas com automação via geckodriver, sem desativar sua proteção.

- Tente abrir o Firefox normalmente pelo sistema e acessar o painel.
- Se funcionar fora do agente, faça a captura manualmente pelo navegador ou pela ferramenta de captura do sistema.
- Se o bloqueio ocorrer apenas no terminal do agente, confira as permissões efetivas dessa sessão antes de repetir a automação.
- Se também falhar fora do agente, confira a mensagem e a instalação Snap/AppArmor no sistema. Não desative AppArmor ou a proteção do navegador como tentativa genérica de correção.

O servidor e o navegador são verificações separadas: a API responder não garante que a ferramenta de captura consiga iniciar, e uma falha do navegador não significa que o projeto esteja com erro.
