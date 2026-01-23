// src/components/LoginForm.ts
import { signUp, signIn } from '../lib/auth.ts'
import { loadCapsules } from '../main.ts'

export function renderLoginForm(container: HTMLElement) {
  container.innerHTML = `
    <div class="login-container" style="max-width: 440px; margin: 140px auto; padding: 52px 40px; background: linear-gradient(135deg, rgba(30,30,60,0.85), rgba(50,50,100,0.75)); border-radius: 28px; backdrop-filter: blur(16px); text-align: center; box-shadow: 0 20px 80px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.15);">
      <h2 style="margin-bottom: 28px; font-size: 2.6rem; font-weight: 900; color: #fff; letter-spacing: -1px; text-shadow: 0 4px 12px rgba(0,0,0,0.5);">FutureBox</h2>
      
      <!-- 프라이버시 강조 박스 -->
      <div style="margin-bottom: 32px; padding: 16px 20px; background: rgba(0,0,0,0.35); border-radius: 16px; border: 1px solid rgba(255,255,255,0.2);">
        <p style="font-size: 1rem; color: #fbbf24; font-weight: 700; margin-bottom: 8px;">
          🔒 100% 비밀 보장
        </p>
        <p style="font-size: 0.9rem; color: rgba(255,255,255,0.9); line-height: 1.5;">
          관리자도, 그 누구도<br/>
          당신의 메시지를 절대 볼 수 없습니다
        </p>
      </div>

      <!-- 탭 -->
      <div class="tabs" style="margin-bottom: 36px; display: flex; justify-content: center; background: rgba(0,0,0,0.3); border-radius: 16px; padding: 6px; width: fit-content; margin-left: auto; margin-right: auto;">
        <button id="login-tab" class="tab active" style="padding: 14px 36px; background: transparent; border: none; color: white; font-size: 1.1rem; font-weight: 700; cursor: pointer; border-radius: 12px; transition: all 0.3s;">로그인</button>
        <button id="signup-tab" class="tab" style="padding: 14px 36px; background: transparent; border: none; color: white; font-size: 1.1rem; font-weight: 700; cursor: pointer; border-radius: 12px; transition: all 0.3s;">회원가입</button>
      </div>

      <!-- 폼 -->
      <form id="auth-form" style="display: flex; flex-direction: column; gap: 20px;">
        <input 
          id="email" 
          type="email" 
          placeholder="이메일 주소" 
          required 
          style="padding: 18px 20px; border-radius: 16px; border: none; font-size: 1.15rem; background: rgba(255,255,255,0.95); box-shadow: inset 0 2px 8px rgba(0,0,0,0.1); transition: all 0.3s;"
        />
        <input 
          id="password" 
          type="password" 
          placeholder="비밀번호" 
          required 
          style="padding: 18px 20px; border-radius: 16px; border: none; font-size: 1.15rem; background: rgba(255,255,255,0.95); box-shadow: inset 0 2px 8px rgba(0,0,0,0.1); transition: all 0.3s;"
        />
        <button 
          id="submit-btn" 
          type="submit" 
          style="padding: 18px; background: linear-gradient(135deg, #4f46e5, #7c4dff); color: white; border: none; border-radius: 16px; font-size: 1.2rem; font-weight: 700; cursor: pointer; transition: all 0.3s; box-shadow: 0 8px 24px rgba(79,70,229,0.4);"
        >
          로그인
        </button>
      </form>

      <p id="auth-message" style="margin-top: 28px; font-size: 1rem; font-weight: 600; min-height: 24px;"></p>
    </div>
  `

  const tabs = document.querySelectorAll('.tab')
  const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement
  const message = document.getElementById('auth-message') as HTMLParagraphElement
  let isLoginMode = true

  // 탭 전환 + 애니메이션
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      isLoginMode = tab.id === 'login-tab'
      submitBtn.textContent = isLoginMode ? '로그인' : '회원가입'

      // 탭 배경 부드럽게 전환
      if (isLoginMode) {
        (tabs[0] as HTMLElement).style.background = 'rgba(255,255,255,0.25)'
        ;(tabs[1] as HTMLElement).style.background = 'transparent'
      } else {
        ;(tabs[0] as HTMLElement).style.background = 'transparent'
        ;(tabs[1] as HTMLElement).style.background = 'rgba(255,255,255,0.25)'
      }
    })
  })

  // 입력창 포커스 시 강조 효과
  const inputs = document.querySelectorAll('input')
  inputs.forEach(input => {
    input.addEventListener('focus', () => {
      input.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.4)'
    })
    input.addEventListener('blur', () => {
      input.style.boxShadow = 'inset 0 2px 8px rgba(0,0,0,0.1)'
    })
  })

  // 폼 제출 + 로딩 상태
  document.getElementById('auth-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    message.textContent = ''
    message.style.color = ''

    const email = (document.getElementById('email') as HTMLInputElement).value.trim()
    const password = (document.getElementById('password') as HTMLInputElement).value

    if (!email || !password) {
      message.style.color = '#ff6b6b'
      message.textContent = '모든 항목을 입력해주세요.'
      return
    }

    try {
      submitBtn.disabled = true
      submitBtn.innerHTML = '처리 중... <span style="margin-left:10px; animation: spin 1s linear infinite;">⏳</span>'

      let user
      if (isLoginMode) {
        user = await signIn(email, password)
        console.log('로그인된 사용자:', user)
        message.style.color = '#34d399'
        message.textContent = '로그인 성공! 잠시만 기다려주세요...'
      } else {
        user = await signUp(email, password)
        message.style.color = '#34d399'
        message.textContent = '회원가입 성공! 자동 로그인되었습니다.'
      }

      setTimeout(() => {
        loadCapsules()
      }, 1200)
    } catch (err: any) {
      message.style.color = '#ff6b6b'
      message.textContent = err.message || '오류가 발생했습니다.'
      submitBtn.disabled = false
      submitBtn.innerHTML = isLoginMode ? '로그인' : '회원가입'
    }
  })
}