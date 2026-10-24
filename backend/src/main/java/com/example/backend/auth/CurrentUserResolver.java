package com.example.backend.auth;

import com.example.backend.common.ApiException;
import com.example.backend.domain.UserAccount;
import com.example.backend.store.Db;
import java.util.List;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.MethodParameter;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Lets controllers declare a {@link CurrentUser} parameter. Studio coaches are re-checked against
 * their account on every request, so a coach the owner deactivated loses access immediately rather
 * than when their token expires.
 */
@Configuration
public class CurrentUserResolver implements WebMvcConfigurer, HandlerMethodArgumentResolver {

    private final Db db;

    public CurrentUserResolver(@Lazy Db db) {
        this.db = db;
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(this);
    }

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.getParameterType().equals(CurrentUser.class);
    }

    @Override
    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mav, NativeWebRequest request, WebDataBinderFactory binder) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (!(auth != null && auth.getPrincipal() instanceof Jwt jwt)) throw ApiException.unauthorized("請先登入");
        CurrentUser user = CurrentUser.from(jwt);
        if (user.isStudioCoach()) {
            UserAccount u = db.get(db.doc(Db.USERS, user.userId()), UserAccount.class).orElse(null);
            if (u == null || Boolean.FALSE.equals(u.active)) throw ApiException.unauthorized("此帳號已停用，請聯絡工作室");
            // Left or was removed from the studio: their account now has its own workspace.
            if (!user.coachId().equals(u.coachId)) throw ApiException.unauthorized("你已不在這個工作室，請重新登入");
        }
        return user;
    }
}
