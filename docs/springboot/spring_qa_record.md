# Spring 遇到的问题记录

## springboot开启事务支持时报代理错误

问题报错：

`The bean 'xxx' could not be injected as a 'com.github.service.xx' because it is a JDK dynamic proxy`

问题来源：在springboot配置事务时出现的，搭建一个springboot的web框架后，启动事务配置只需要如下两步即可完成：

1.在启动类Application类上设置@EnableTransactionManagement，表示启动springboot事务支持
2.在Service层的实现类中指定的方法上设置@Transactional

以上简单的两步即可完成，但偏偏在启动后会报如上错误。通过观察控制台报错的原因如下：
Console描述1： 
Description:The bean 'userServiceImpl' could not be injected as a 'com.ysq.springboot.service.Impl.UserServiceImpl' because it is a JDK dynamic proxy that implements:  
com.ysq.springboot.service.UserService根据上面描述，它是在我的Action层中，注入userServiceImpl这个Bean时失败,(失败的原因就是我有实现接口，而`springboot的事务默认是使用jdk的动态代理，即基于接口`）)。到这里我突然明白了，在action层中我注入的Bean是实现类，因此就会报错。于是我将此注入Bean的方式改成了其接口，问题迎刃而解。  
Console描述2：  
Action:Consider injecting the bean as one of its interfaces or forcing the use of CGLib-based proxies by setting proxyTargetClass=true on @EnableAsync and/or @EnableCaching.  
在看上面的描述它给了我们解决此问题的方案，说你可以考虑下将action中注入的Bean改成接口方式或者强迫事务使用CGLib代理方式（基于类，即设置proxyTargetClass=True在启动事务管理上@EnableTransactionManagement(proxyTargetClass=True)），这种以CGLib代理方式进行，按照之前写法，我们应该是需要引入相应的cglib库的jar包。而在springboot中已经集成了。但在spring3.2之前是需要引入的;

假如你是在不想将注入的Bean改成接口方式，非得要用实现类，而且还不想再启动事务时配置proxyTargetClass=true，那么接下来让你知道什么叫厉害，有如下方法：  
在你Service层对应的实现类上配置`@Scope(proxyMode = ScopedProxyMode.TARGET_CLASS)`注解，表明此类上所有方法上的事务都是CGLib方式代理的，问题照样可以解决。（参考：https://blog.csdn.net/z394642048/article/details/84759331）
