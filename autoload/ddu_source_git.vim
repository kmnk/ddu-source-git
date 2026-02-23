" autoload/ddu_source_git.vim

" 内部ヘルパー: 有効な cwd を解決する
function! s:cwd(args) abort
  if !empty(a:args)
    return a:args[0]
  endif
  let l:path = expand('%:p:h')
  return (!empty(l:path) && l:path !=# '.') ? l:path : getcwd()
endfunction

" 現在のブランチ名（detached HEAD の場合は短縮ハッシュ）を返す
function! ddu_source_git#head(...) abort
  let l:cwd = s:cwd(a:000)
  let l:out = system('git -C ' . shellescape(l:cwd) . ' symbolic-ref --short HEAD 2>/dev/null')
  if v:shell_error != 0
    let l:out = system('git -C ' . shellescape(l:cwd) . ' rev-parse --short HEAD 2>/dev/null')
  endif
  return v:shell_error != 0 ? '' : trim(l:out)
endfunction

" HEAD の完全コミットハッシュを返す
function! ddu_source_git#hash(...) abort
  let l:cwd = s:cwd(a:000)
  let l:out = system('git -C ' . shellescape(l:cwd) . ' rev-parse HEAD 2>/dev/null')
  return v:shell_error != 0 ? '' : trim(l:out)
endfunction

" リポジトリルートの絶対パスを返す
function! ddu_source_git#toplevel(...) abort
  let l:cwd = s:cwd(a:000)
  let l:out = system('git -C ' . shellescape(l:cwd) . ' rev-parse --show-toplevel 2>/dev/null')
  return v:shell_error != 0 ? '' : trim(l:out)
endfunction

" リポジトリ名（toplevel のディレクトリ名）を返す
function! ddu_source_git#repo(...) abort
  let l:top = ddu_source_git#toplevel(s:cwd(a:000))
  return empty(l:top) ? '' : fnamemodify(l:top, ':t')
endfunction

" リモートリポジトリのフルネーム（owner/repo 形式）を返す
function! ddu_source_git#remote_repo(...) abort
  let l:cwd = s:cwd(a:000)
  let l:url = system('git -C ' . shellescape(l:cwd) . ' remote get-url origin 2>/dev/null')
  if v:shell_error != 0
    return ''
  endif
  let l:url = substitute(trim(l:url), '\.git$', '', '')
  " HTTPS/SSH URL: https://host/owner/repo または ssh://git@host/owner/repo
  let l:m = matchlist(l:url, '://[^/]\+/\(.\+\)$')
  if !empty(l:m)
    return l:m[1]
  endif
  " SCP 形式: git@host:owner/repo
  let l:m = matchlist(l:url, '@[^:]\+:\(.\+\)$')
  if !empty(l:m)
    return l:m[1]
  endif
  return ''
endfunction
